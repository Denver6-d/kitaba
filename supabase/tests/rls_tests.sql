-- RLS tests (v2, spelling). Paste into the Supabase SQL editor and run.
-- Everything happens inside one transaction that is ROLLED BACK at the end:
-- the two test users and all their rows disappear afterwards.
-- Every check raises an exception on failure; success prints "ALL RLS TESTS PASSED".

begin;

-- Two throwaway users.
insert into auth.users (id, aud, role, email, instance_id)
values
  ('00000000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'rls-test-a@example.invalid', '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'rls-test-b@example.invalid', '00000000-0000-0000-0000-000000000000');

-- Helper: act as a given user (or anon when null).
create or replace function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  if uid is null then
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  else
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  end if;
end $$;

-- ---------------------------------------------------------------- progress_records
select pg_temp.act_as('00000000-0000-4000-8000-00000000000a');
select public.upsert_progress('[{"table_name":"profile","id":"me","data":{"id":"me","updatedAt":10},"updated_at":10}]'::jsonb);

-- A sees exactly one row.
do $$ begin
  if (select count(*) from public.progress_records) <> 1 then raise exception 'A should see 1 row'; end if;
end $$;

-- Older write does not overwrite newer.
select public.upsert_progress('[{"table_name":"profile","id":"me","data":{"id":"me","updatedAt":5,"stale":true},"updated_at":5}]'::jsonb);
do $$ begin
  if (select updated_at from public.progress_records where id = 'me') <> 10 then raise exception 'stale write overwrote newer row'; end if;
end $$;

-- No direct inserts at all (writes go through upsert_progress), and never for another user.
do $$ begin
  begin
    insert into public.progress_records (user_id, table_name, id, data, updated_at)
    values ('00000000-0000-4000-8000-00000000000b', 'profile', 'x', '{}'::jsonb, 1);
    raise exception 'direct insert into progress_records allowed';
  exception when insufficient_privilege or check_violation then null;
  end;
end $$;

-- Far-future timestamps are rejected.
do $$ begin
  begin
    perform public.upsert_progress('[{"table_name":"mastery","id":"f","data":{},"updated_at":9999999999999}]'::jsonb);
    raise exception 'far-future updated_at accepted';
  exception when check_violation then null;
  end;
end $$;

-- Unknown table names are rejected.
do $$ begin
  begin
    perform public.upsert_progress('[{"table_name":"secrets","id":"x","data":{},"updated_at":1}]'::jsonb);
    raise exception 'unknown table_name accepted';
  exception when check_violation then null;
  end;
end $$;

-- Phase F tables (migration 20261118000001) are accepted, still only for the caller.
select public.upsert_progress('[{"table_name":"writings","id":"w1","data":{"id":"w1","updatedAt":1},"updated_at":1},{"table_name":"dictionary","id":"padel","data":{"id":"padel","updatedAt":1,"word":"padel"},"updated_at":1}]'::jsonb);
do $ begin
  if (select count(*) from public.progress_records where table_name in ('writings', 'dictionary') and user_id = auth.uid()) <> 2 then
    raise exception 'writings/dictionary rows were not stored for the caller';
  end if;
end $;

-- B sees nothing of A's and cannot change or delete it.
select pg_temp.act_as('00000000-0000-4000-8000-00000000000b');
do $$ begin
  if (select count(*) from public.progress_records) <> 0 then raise exception 'B can read A''s rows'; end if;
  update public.progress_records set updated_at = 999 where id = 'me';
  delete from public.progress_records where id = 'me';
end $$;
select pg_temp.act_as('00000000-0000-4000-8000-00000000000a');
do $$ begin
  if (select updated_at from public.progress_records where id = 'me') <> 10 then raise exception 'B modified A''s row'; end if;
end $$;

-- Anonymous callers get nothing and cannot use the RPC.
select pg_temp.act_as(null);
do $$ begin
  begin
    perform count(*) from public.progress_records;
    raise exception 'anon can select progress_records';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.upsert_progress('[]'::jsonb);
    raise exception 'anon can call upsert_progress';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.delete_my_account();
    raise exception 'anon can call delete_my_account';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---------------------------------------------------------------- leaderboard (migration 2)
-- Skipped automatically if the leaderboard migration has not been run yet.
do $$ begin
  if to_regclass('public.leaderboard_scores') is null then
    raise notice 'leaderboard tables not found: skipping leaderboard tests';
    return;
  end if;

  perform pg_temp.act_as('00000000-0000-4000-8000-00000000000a');

  -- Not opted in yet: submissions are rejected. Arguments: points, correct, total, duration_s.
  if (public.submit_score(120, 9, 10, 90)) ->> 'status' <> 'not_opted_in' then raise exception 'score accepted without opt-in'; end if;

  perform public.set_leaderboard_nickname('Test_A');
  if (public.submit_score(120, 9, 10, 90)) ->> 'status' <> 'ok' then raise exception 'valid score rejected'; end if;

  -- Rate limit, then plausibility (each check returns before the rate limit when it fails first).
  if (public.submit_score(120, 9, 10, 90)) ->> 'status' <> 'rate_limited' then raise exception 'rate limit missing'; end if;
  if (public.submit_score(1000, 9, 10, 90)) ->> 'status' <> 'implausible' then raise exception 'too many points accepted'; end if;
  if (public.submit_score(120, 11, 10, 90)) ->> 'status' <> 'implausible' then raise exception 'correct > total accepted'; end if;
  if (public.submit_score(120, 9, 10, 3)) ->> 'status' <> 'implausible' then raise exception 'impossibly fast game accepted'; end if;
  if (public.submit_score(40, 4, 10, 90)) ->> 'status' <> 'low_accuracy' then raise exception 'low accuracy accepted'; end if;
  if (public.submit_score(40, 4, 4, 30)) ->> 'status' <> 'too_short' then raise exception 'short game accepted'; end if;

  -- No direct writes to scores.
  begin
    insert into public.leaderboard_scores (user_id, points, correct, total, duration_s) values (auth.uid(), 2000, 60, 60, 60);
    raise exception 'direct insert into leaderboard_scores allowed';
  exception when insufficient_privilege then null;
  end;

  -- Nicknames: unique ignoring case, blocked words refused (even disguised), invalid characters refused.
  perform pg_temp.act_as('00000000-0000-4000-8000-00000000000b');
  if (public.set_leaderboard_nickname('test_a')) ->> 'status' <> 'taken' then raise exception 'duplicate nickname accepted'; end if;
  if (public.set_leaderboard_nickname('Sh1t Head')) ->> 'status' <> 'blocked' then raise exception 'blocked nickname accepted'; end if;
  if (public.set_leaderboard_nickname('<b>hi</b>')) ->> 'status' <> 'chars' then raise exception 'markup nickname accepted'; end if;
  if (public.set_leaderboard_nickname('ab')) ->> 'status' <> 'length' then raise exception 'short nickname accepted'; end if;

  -- B cannot see A's profile or scores directly, nor the blocked-word list.
  if (select count(*) from public.leaderboard_profiles) <> 0 then raise exception 'B can read A''s leaderboard profile'; end if;
  if (select count(*) from public.leaderboard_scores) <> 0 then raise exception 'B can read A''s scores'; end if;
  begin
    perform count(*) from public.leaderboard_blocked_words;
    raise exception 'blocked words readable by clients';
  exception when insufficient_privilege then null;
  end;

  -- Anonymous callers cannot submit, join or leave.
  perform pg_temp.act_as(null);
  begin
    perform public.submit_score(120, 9, 10, 90);
    raise exception 'anon can call submit_score';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.set_leaderboard_nickname('Anon_1');
    raise exception 'anon can call set_leaderboard_nickname';
  exception when insufficient_privilege then null;
  end;

  -- The public view exposes nickname and weekly score only.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leaderboard_weekly'
      and column_name not in ('rank', 'nickname', 'points', 'words', 'last_at')
  ) then
    raise exception 'leaderboard view exposes extra columns';
  end if;
  if to_regclass('public.leaderboard_all_time') is not null then raise exception 'old all-time view still exists'; end if;
  if (select points from public.leaderboard_weekly where nickname = 'Test_A') <> 120 then raise exception 'opted-in weekly score not public'; end if;

  -- Leaving removes the scores and hides the nickname.
  perform pg_temp.act_as('00000000-0000-4000-8000-00000000000a');
  perform public.leave_leaderboard();
  perform pg_temp.act_as(null);
  if (select count(*) from public.leaderboard_weekly where nickname = 'Test_A') <> 0 then raise exception 'left user still public'; end if;
end $$;

select 'ALL RLS TESTS PASSED' as result;

rollback;
