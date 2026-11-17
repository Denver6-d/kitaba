-- Kitaba: progress sync schema.
-- Run in the Supabase SQL editor (or `supabase db push`). Safe to re-run.
--
-- One table stores every synced progress record as JSON, keyed by
-- (user, table, record id). Row Level Security restricts every row to its owner.

create table if not exists public.progress_records (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  table_name text not null check (
    table_name in ('results', 'keystats', 'ghosts', 'srs', 'attempts', 'mastery', 'scenarios', 'activity', 'achievements', 'profile')
  ),
  id text not null check (char_length(id) between 1 and 200),
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 65536),
  -- Client write time in ms: the last-write-wins key used by the merge rules.
  updated_at bigint not null check (updated_at >= 0),
  deleted_at bigint check (deleted_at is null or deleted_at >= 0),
  -- Server time of the last change: the pull cursor (immune to client clock skew).
  server_updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, table_name, id)
);

create index if not exists progress_records_pull_idx on public.progress_records (user_id, server_updated_at);

create or replace function public.touch_progress_record()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists progress_records_touch on public.progress_records;
create trigger progress_records_touch
  before insert or update on public.progress_records
  for each row execute function public.touch_progress_record();

-- Row Level Security: a user can only see and change their own rows.
alter table public.progress_records enable row level security;
alter table public.progress_records force row level security;

drop policy if exists "progress: owner can read" on public.progress_records;
create policy "progress: owner can read" on public.progress_records
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "progress: owner can insert" on public.progress_records;
create policy "progress: owner can insert" on public.progress_records
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "progress: owner can update" on public.progress_records;
create policy "progress: owner can update" on public.progress_records
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "progress: owner can delete" on public.progress_records;
create policy "progress: owner can delete" on public.progress_records
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on table public.progress_records from anon;
grant select, insert, update, delete on table public.progress_records to authenticated;

-- Batched upsert with last-write-wins: an older write never overwrites a newer one.
-- SECURITY INVOKER, so the RLS policies above still apply to every row.
create or replace function public.upsert_progress(records jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  n integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if jsonb_typeof(records) <> 'array' or jsonb_array_length(records) > 500 then
    raise exception 'invalid batch' using errcode = '22023';
  end if;

  insert into public.progress_records as p (user_id, table_name, id, data, updated_at, deleted_at)
  select auth.uid(), r ->> 'table_name', r ->> 'id', r -> 'data', (r ->> 'updated_at')::bigint, (r ->> 'deleted_at')::bigint
  from jsonb_array_elements(records) as r
  on conflict (user_id, table_name, id) do update
    set data = excluded.data,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at
    where p.updated_at <= excluded.updated_at;

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.upsert_progress(jsonb) from public, anon;
grant execute on function public.upsert_progress(jsonb) to authenticated;

-- "Delete my account and all my data", callable by the signed-in user only.
-- SECURITY DEFINER is required to remove the auth.users row; it only ever
-- touches auth.uid(), so no service_role key is needed in the app.
create or replace function public.delete_my_account()
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
  delete from public.progress_records where user_id = uid;
  -- Leaderboard rows (migration 2) cascade from auth.users.
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
