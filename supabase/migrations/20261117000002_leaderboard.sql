-- Opt-in weekly spelling leaderboard. Run after 20261117000001_progress.sql. Safe to re-run.
--
-- Privacy model:
-- * Nothing about a user is public until they choose a nickname (opt in).
-- * Clients cannot write scores directly: only submit_score() can, and it
--   validates plausibility and rate limits, and only ever writes the caller's row.
-- * The public reads views that expose nickname, score and date only.
-- * Client-reported scores can never be made fully cheat-proof; these checks
--   only make cheating harder.

-- ---------------------------------------------------------------- tables
create table if not exists public.leaderboard_profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 3 and 20 and nickname ~ '^[A-Za-z0-9 _ء-ي-]+$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists leaderboard_profiles_nickname_key on public.leaderboard_profiles (lower(nickname));

-- One row per submitted spelling game. The public board shows the weekly sum.
create table if not exists public.leaderboard_scores (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  points integer not null check (points between 0 and 2700),
  correct integer not null check (correct between 0 and 60),
  total integer not null check (total between 5 and 60 and correct <= total),
  duration_s integer not null check (duration_s between 5 and 3600),
  created_at timestamptz not null default now()
);
create index if not exists leaderboard_scores_user_idx on public.leaderboard_scores (user_id, created_at desc);
create index if not exists leaderboard_scores_time_idx on public.leaderboard_scores (created_at);

-- Blocked words for nicknames (normalised: lower case, de-leeted, letters only).
-- Not readable by clients. Keep in sync with src/domain/leaderboard/nickname.ts (a test checks this).
create table if not exists public.leaderboard_blocked_words (word text primary key);
insert into public.leaderboard_blocked_words (word) values
  ('admin'), ('kitaba'), ('moderator'), ('support'), ('official'),
  ('fuck'), ('shit'), ('bitch'), ('cunt'), ('dick'), ('pussy'), ('asshole'), ('bastard'), ('whore'), ('slut'),
  ('nigger'), ('nigga'), ('faggot'), ('retard'), ('hitler'), ('porn'),
  ('شرموط'), ('قحبة'), ('منيوك'), ('عرص'), ('خول'), ('كلب'), ('حمار'), ('زبالة')
on conflict do nothing;

-- ---------------------------------------------------------------- RLS
-- Enabled, not forced (see the progress migration): clients are never the owner, and the
-- owner-run views and SECURITY DEFINER functions below must read and write every row.
alter table public.leaderboard_profiles enable row level security;
alter table public.leaderboard_scores enable row level security;
alter table public.leaderboard_blocked_words enable row level security;

-- Users may read only their own profile and scores directly. All writes go through the functions below.
drop policy if exists "leaderboard profile: owner can read" on public.leaderboard_profiles;
create policy "leaderboard profile: owner can read" on public.leaderboard_profiles
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "leaderboard scores: owner can read" on public.leaderboard_scores;
create policy "leaderboard scores: owner can read" on public.leaderboard_scores
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on table public.leaderboard_profiles, public.leaderboard_scores, public.leaderboard_blocked_words from anon, authenticated;
grant select on table public.leaderboard_profiles, public.leaderboard_scores to authenticated;

-- ---------------------------------------------------------------- public view
-- The view runs as its owner, so it can read every opted-in row, but it only
-- exposes these five columns: never user ids or emails.
drop view if exists public.leaderboard_all_time;
drop view if exists public.leaderboard_weekly;
create view public.leaderboard_weekly as
  with week as (
    select s.user_id, sum(s.points)::integer as points, sum(s.correct)::integer as words, max(s.created_at) as last_at
    from public.leaderboard_scores s
    -- The week starts on Monday 00:00 UTC.
    where s.created_at >= date_trunc('week', now() at time zone 'utc') at time zone 'utc'
    group by s.user_id
  )
  select rank() over (order by w.points desc, w.words desc)::integer as rank,
         p.nickname, w.points, w.words, w.last_at
  from week w
  join public.leaderboard_profiles p on p.user_id = w.user_id
  order by rank, p.nickname
  limit 100;

revoke all on public.leaderboard_weekly from anon, authenticated;
grant select on public.leaderboard_weekly to anon, authenticated;

-- ---------------------------------------------------------------- functions
create or replace function public.normalize_nickname_for_filter(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(translate(lower(p), '01345 7@$!', 'oieas tasi'), '[^a-zء-ي]', '', 'g');
$$;

-- Join the board or change the nickname. Returns {"status": ok|length|chars|blocked|taken}.
create or replace function public.set_leaderboard_nickname(p_nickname text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  nick text := regexp_replace(btrim(coalesce(p_nickname, '')), '\s+', ' ', 'g');
  norm text;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if char_length(nick) < 3 or char_length(nick) > 20 then
    return jsonb_build_object('status', 'length');
  end if;
  if nick !~ '^[A-Za-z0-9 _ء-ي-]+$' then
    return jsonb_build_object('status', 'chars');
  end if;
  norm := public.normalize_nickname_for_filter(nick);
  if exists (select 1 from public.leaderboard_blocked_words w where position(w.word in norm) > 0) then
    return jsonb_build_object('status', 'blocked');
  end if;
  if exists (select 1 from public.leaderboard_profiles p where lower(p.nickname) = lower(nick) and p.user_id <> uid) then
    return jsonb_build_object('status', 'taken');
  end if;
  insert into public.leaderboard_profiles (user_id, nickname)
  values (uid, nick)
  on conflict (user_id) do update set nickname = excluded.nickname, updated_at = now();
  return jsonb_build_object('status', 'ok', 'nickname', nick);
exception
  when unique_violation then
    return jsonb_build_object('status', 'taken');
end;
$$;

-- Leave the board: removes the nickname and every score immediately.
create or replace function public.leave_leaderboard()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  delete from public.leaderboard_scores where user_id = uid;
  delete from public.leaderboard_profiles where user_id = uid;
end;
$$;

-- Submit a finished spelling game. Validates plausibility and rate limits, writes only the caller's row.
-- Keep the thresholds in sync with src/domain/leaderboard/plausibility.ts (a test checks this).
-- Returns {"status": ok|not_opted_in|too_short|low_accuracy|implausible|rate_limited}.
drop function if exists public.submit_score(numeric, numeric, integer, integer);
create or replace function public.submit_score(p_points integer, p_correct integer, p_total integer, p_duration_s integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not exists (select 1 from public.leaderboard_profiles where user_id = uid) then
    return jsonb_build_object('status', 'not_opted_in');
  end if;
  if p_points is null or p_correct is null or p_total is null or p_duration_s is null then
    return jsonb_build_object('status', 'implausible');
  end if;
  if p_total < 5 then
    return jsonb_build_object('status', 'too_short');
  end if;
  if p_total > 60 or p_correct < 0 or p_correct > p_total or p_points < 0 then
    return jsonb_build_object('status', 'implausible');
  end if;
  if p_correct * 100 < p_total * 50 then
    return jsonb_build_object('status', 'low_accuracy');
  end if;
  -- At most 10 points x the top combo multiplier (4) + a speed bonus of 5 per correct word.
  if p_points > p_correct * 45 then
    return jsonb_build_object('status', 'implausible');
  end if;
  -- At least 1 second per item.
  if p_duration_s < p_total * 1 or p_duration_s > 3600 then
    return jsonb_build_object('status', 'implausible');
  end if;
  -- Rate limits: one score per 20 seconds, at most 60 per day. A per-user lock makes
  -- concurrent calls wait, so parallel requests cannot slip past the checks.
  perform pg_advisory_xact_lock(hashtextextended('kitaba.submit_score:' || uid::text, 0));
  if exists (select 1 from public.leaderboard_scores where user_id = uid and created_at > now() - interval '20 seconds') then
    return jsonb_build_object('status', 'rate_limited');
  end if;
  if (select count(*) from public.leaderboard_scores where user_id = uid and created_at > now() - interval '1 day') >= 60 then
    return jsonb_build_object('status', 'rate_limited');
  end if;
  insert into public.leaderboard_scores (user_id, points, correct, total, duration_s)
  values (uid, p_points, p_correct, p_total, p_duration_s);
  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function public.set_leaderboard_nickname(text), public.leave_leaderboard(), public.submit_score(integer, integer, integer, integer) from public, anon;
grant execute on function public.set_leaderboard_nickname(text), public.leave_leaderboard(), public.submit_score(integer, integer, integer, integer) to authenticated;
revoke all on function public.normalize_nickname_for_filter(text) from public, anon, authenticated;
