-- Kitaba RLS tests. Paste into the Supabase SQL editor and run.
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

  -- Not opted in yet: submissions are rejected.
  if (public.submit_score(60, 97, 60, 300)) ->> 'status' <> 'not_opted_in' then raise exception 'score accepted without opt-in'; end if;

  perform public.set_leaderboard_nickname('Test_A');
  if (public.submit_score(60, 97, 60, 300)) ->> 'status' <> 'ok' then raise exception 'valid score rejected'; end if;

  -- Plausibility and rate limits.
  if (public.submit_score(61, 97, 60, 305)) ->> 'status' <> 'rate_limited' then raise exception 'rate limit missing'; end if;
  if (public.submit_score(300, 99, 60, 1500)) ->> 'status' not in ('implausible', 'rate_limited') then raise exception 'implausible wpm accepted'; end if;
  if (public.submit_score(60, 50, 60, 300)) ->> 'status' not in ('low_accuracy', 'rate_limited') then raise exception 'low accuracy accepted'; end if;
  if (public.submit_score(60, 97, 10, 50)) ->> 'status' not in ('too_short', 'rate_limited') then raise exception 'short test accepted'; end if;

  -- No direct writes to scores.
  begin
    insert into public.leaderboard_scores (user_id, wpm, accuracy, duration_s) values (auth.uid(), 200, 100, 60);
    raise exception 'direct insert into leaderboard_scores allowed';
  exception when insufficient_privilege then null;
  end;

  -- Public views expose nickname/score/date only.
  perform pg_temp.act_as(null);
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name in ('leaderboard_weekly', 'leaderboard_all_time')
      and column_name not in ('rank', 'nickname', 'wpm', 'accuracy', 'achieved_at')
  ) then
    raise exception 'leaderboard views expose extra columns';
  end if;
  if (select count(*) from public.leaderboard_all_time where nickname = 'Test_A') <> 1 then raise exception 'opted-in score not public'; end if;

  -- Leaving removes the scores and hides the nickname.
  perform pg_temp.act_as('00000000-0000-4000-8000-00000000000a');
  perform public.leave_leaderboard();
  perform pg_temp.act_as(null);
  if (select count(*) from public.leaderboard_all_time where nickname = 'Test_A') <> 0 then raise exception 'left user still public'; end if;
end $$;

select 'ALL RLS TESTS PASSED' as result;

rollback;
