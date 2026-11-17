# RLS and security checklist

Run `rls_tests.sql` in the Supabase SQL editor after the migrations. Then check each item. All must hold before going live.

## progress_records (migration 1)
- [ ] RLS is **enabled** on `public.progress_records` (deliberately not forced: the owner-run `SECURITY DEFINER` functions are the only write path).
- [ ] `anon` has no table privileges. A signed-out REST call `GET /rest/v1/progress_records` returns `[]` or 401, never rows.
- [ ] `authenticated` has only `select` and `delete` on the table, so a direct `insert` or `update` fails with `insufficient_privilege`.
- [ ] User A cannot select or delete rows with `user_id = B`. The script checks this by impersonating two users.
- [ ] `upsert_progress` always writes `user_id = auth.uid()`; it cannot create or change another user's rows.
- [ ] `upsert_progress` with an older `updated_at` does not overwrite a newer row (last-write-wins guard).
- [ ] `upsert_progress` rejects batches over 500 rows and rejects anonymous callers.
- [ ] Rows over 64 KB, with an unknown `table_name`, or with an `updated_at` after the year 2100 are rejected by the check constraints.
- [ ] A user cannot store more than 50,000 records (quota trigger).

## Account deletion
- [ ] `delete_my_account()` is executable by `authenticated` only (not `anon`, not `public`).
- [ ] It deletes only `auth.uid()`: the caller's progress rows, leaderboard rows (cascade) and auth user.

## Leaderboard (migration 2)
- [ ] RLS is enabled on `leaderboard_profiles` and `leaderboard_scores`.
- [ ] The client has **no** insert or update policy on `leaderboard_scores`. Scores can only be written through `submit_score()`.
- [ ] `submit_score()` rejects: not opted in; duration under 30 s; accuracy under 90%; WPM over 250; WPM inconsistent with chars and duration; more than 1 submission per 20 s; more than 60 per day.
- [ ] The public views `leaderboard_weekly` and `leaderboard_all_time` expose only `rank, nickname, wpm, accuracy, achieved_at`. No `user_id`, no email.
- [ ] Opted-out users never appear in the views. `leave_leaderboard()` deletes the caller's scores.
- [ ] Nicknames are unique (case-insensitive), 3–20 characters, letters (Latin or Arabic), digits, space, `_` and `-`, and not on the blocked-word list.

## Client bundle
- [ ] `grep -r "service_role" .next/static` finds nothing, and the only Supabase key in the bundle is the anon key.
