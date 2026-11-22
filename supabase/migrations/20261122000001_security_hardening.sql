-- Security hardening (DECISIONS SEC2–SEC5), from the 2026-11-22 security review.
-- Run after 20261117000001_progress.sql, 20261117000002_leaderboard.sql and
-- 20261118000001_writing.sql. Paste the whole file into the Supabase SQL editor
-- and run it once; it is one transaction and safe to re-run.
--
--   SEC2. Storage: one record at most 16 KB of JSON text (was 64 KB compressed);
--       per user at most 30,000 records and 20 MB (was 50,000 records, about 3.2 GB),
--       counted in a per-user row that is locked on every write (no count(*), no race).
--   SEC3. Nickname filter: tatweel dropped and Arabic letter variants folded before matching.
--   SEC4. submit_score: at least 1.5 s per word (was 1 s), at most 30 games a day (was 60).
--   SEC5. Public weekly board: the day of the last game, not its exact time.

begin;

-- ======================================================================== SEC2. storage limits
-- Keep writers out while the old trigger is swapped and the counters are rebuilt.
lock table public.progress_records in share row exclusive mode;

-- One record: at most 16,384 bytes of JSON text, measured uncompressed (pg_column_size measured
-- the compressed size, so very repetitive JSON could be far larger). NOT VALID: rows already
-- stored are kept as they are; every new insert or update is checked.
-- Keep in sync with PROGRESS_RECORD_MAX_BYTES in src/domain/model.ts (a test checks this).
alter table public.progress_records drop constraint if exists progress_records_data_check;
alter table public.progress_records
  add constraint progress_records_data_check
  check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 16384) not valid;

-- Per-user usage, kept up to date by the trigger below. Clients have no access at all.
create table if not exists public.progress_usage (
  user_id uuid primary key references auth.users (id) on delete cascade,
  records integer not null default 0 check (records >= 0),
  bytes bigint not null default 0 check (bytes >= 0)
);
alter table public.progress_usage enable row level security;
revoke all on table public.progress_usage from public, anon, authenticated;

-- Rebuild the counters from the stored rows (also correct on a re-run).
delete from public.progress_usage;
insert into public.progress_usage (user_id, records, bytes)
  select user_id, count(*), coalesce(sum(octet_length(data::text)), 0)
  from public.progress_records
  group by user_id;

-- The old per-row count(*) quota (finding 2: slow; finding 6: racy).
drop trigger if exists progress_records_quota on public.progress_records;
drop function if exists public.enforce_progress_quota();

-- Concurrency: every write updates the user's single usage row, which locks it until the
-- transaction ends. A concurrent batch for the same user waits, then reads the committed
-- total, so parallel requests cannot pass the limit together. AFTER triggers see only rows
-- really written: an upsert that loses last-write-wins changes nothing and counts nothing.
-- SECURITY DEFINER: clients delete their own rows (RLS) but have no rights on progress_usage.
create or replace function public.track_progress_usage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  max_records constant integer := 30000;
  max_bytes constant bigint := 20971520; -- 20 MB
  usage_records integer;
  usage_bytes bigint;
  delta bigint;
begin
  if tg_op = 'DELETE' then
    update public.progress_usage as u
      set records = greatest(u.records - 1, 0),
          bytes = greatest(u.bytes - octet_length(old.data::text), 0)
      where u.user_id = old.user_id;
    return old;
  end if;

  if tg_op = 'INSERT' then
    insert into public.progress_usage as u (user_id, records, bytes)
      values (new.user_id, 1, octet_length(new.data::text))
      on conflict (user_id) do update
        set records = u.records + 1, bytes = u.bytes + excluded.bytes
      returning u.records, u.bytes into usage_records, usage_bytes;
  else
    delta := octet_length(new.data::text) - octet_length(old.data::text);
    update public.progress_usage as u
      set bytes = greatest(u.bytes + delta, 0)
      where u.user_id = new.user_id
      returning u.records, u.bytes into usage_records, usage_bytes;
    -- A change that does not grow the data is always allowed, even over the limit.
    if delta <= 0 then
      return new;
    end if;
  end if;

  if usage_records > max_records or usage_bytes > max_bytes then
    raise exception 'progress quota exceeded' using errcode = '54000';
  end if;
  return new;
end;
$$;

revoke all on function public.track_progress_usage() from public, anon, authenticated;

drop trigger if exists progress_records_usage on public.progress_records;
create trigger progress_records_usage
  after insert or update or delete on public.progress_records
  for each row execute function public.track_progress_usage();

-- ======================================================================== SEC3. nickname filter
-- Before matching: lower case, leetspeak to letters, Arabic variants folded
-- (ة→ه, أ/إ/آ→ا, ى→ي), the tatweel U+0640 dropped (translate() deletes a character
-- that has no partner in the second list), then everything but letters removed.
-- Keep in sync with normalizeForFilter() in src/domain/leaderboard/nickname.ts (a test checks this).
create or replace function public.normalize_nickname_for_filter(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
    translate(
      lower(p),
      '01345 7@$!' || U&'\0629\0623\0625\0622\0649\0640',
      'oieas tasi' || U&'\0647\0627\0627\0627\064A'
    ),
    '[^a-zء-ي]', '', 'g');
$$;

-- Unchanged except that the blocked words are normalised the same way before matching,
-- so the listed "قحبة" also catches "قحبه".
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
  if exists (select 1 from public.leaderboard_blocked_words w where position(public.normalize_nickname_for_filter(w.word) in norm) > 0) then
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

-- ======================================================================== SEC4. submit_score
-- Keep the thresholds in sync with src/domain/leaderboard/plausibility.ts (a test checks this).
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
  -- At least 1.5 seconds per item (in tenths: 15), the pace of a 40-word, 60-second Spelling Bee.
  if p_duration_s * 10 < p_total * 15 or p_duration_s > 3600 then
    return jsonb_build_object('status', 'implausible');
  end if;
  -- Rate limits: one score per 20 seconds, at most 30 per day. A per-user lock makes
  -- concurrent calls wait, so parallel requests cannot slip past the checks.
  perform pg_advisory_xact_lock(hashtextextended('kitaba.submit_score:' || uid::text, 0));
  if exists (select 1 from public.leaderboard_scores where user_id = uid and created_at > now() - interval '20 seconds') then
    return jsonb_build_object('status', 'rate_limited');
  end if;
  if (select count(*) from public.leaderboard_scores where user_id = uid and created_at > now() - interval '1 day') >= 30 then
    return jsonb_build_object('status', 'rate_limited');
  end if;
  insert into public.leaderboard_scores (user_id, points, correct, total, duration_s)
  values (uid, p_points, p_correct, p_total, p_duration_s);
  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function public.set_leaderboard_nickname(text), public.submit_score(integer, integer, integer, integer) from public, anon;
grant execute on function public.set_leaderboard_nickname(text), public.submit_score(integer, integer, integer, integer) to authenticated;
revoke all on function public.normalize_nickname_for_filter(text) from public, anon, authenticated;

-- ======================================================================== SEC5. public weekly board
-- last_at is now a date (the UTC day of the last game), not a timestamp. The column keeps
-- its name, so clients built before this change still read it. The type changes, so the
-- view is dropped and created again rather than replaced.
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
         p.nickname, w.points, w.words, (w.last_at at time zone 'utc')::date as last_at
  from week w
  join public.leaderboard_profiles p on p.user_id = w.user_id
  order by rank, p.nickname
  limit 100;

revoke all on public.leaderboard_weekly from anon, authenticated;
grant select on public.leaderboard_weekly to anon, authenticated;

commit;
