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
- [ ] Rows over 64 KB, with an unknown `table_name` (allowed: `srs, mastery, activity, achievements, profile, sessions, stages`), or with an `updated_at` after the year 2100 are rejected by the check constraints.
- [ ] A user cannot store more than 50,000 records (quota trigger).

## Account deletion
- [ ] `delete_my_account()` is executable by `authenticated` only (not `anon`, not `public`).
- [ ] It deletes only `auth.uid()`: the caller's progress rows, leaderboard rows (cascade) and auth user.

## Leaderboard (migration 2)
- [ ] RLS is enabled on `leaderboard_profiles` and `leaderboard_scores`.
- [ ] The client has **no** insert or update policy on `leaderboard_scores`. Scores can only be written through `submit_score()`.
- [ ] `submit_score(points, correct, total, duration_s)` rejects: not opted in; fewer than 5 or more than 60 items; `correct > total`; under 50% correct; more than 45 points per correct word; under 1 second per item; more than 1 submission per 20 s; more than 60 per day. It takes a per-user advisory lock, so parallel calls cannot bypass the rate limit.
- [ ] `anon` cannot call `submit_score()`, `set_leaderboard_nickname()` or `leave_leaderboard()`, and no client can read `leaderboard_blocked_words`.
- [ ] User B cannot read user A's `leaderboard_profiles` or `leaderboard_scores` rows directly.
- [ ] The public view `leaderboard_weekly` exposes only `rank, nickname, points, words, last_at` (the weekly sum since Monday 00:00 UTC). No `user_id`, no email. The old `leaderboard_all_time` view no longer exists.
- [ ] Opted-out users never appear in the view. `leave_leaderboard()` deletes the caller's scores.
- [ ] Nicknames are unique (case-insensitive), 3–20 characters, letters (Latin or Arabic), digits, space, `_` and `-`, and not on the blocked-word list.

## Client bundle
- [ ] `grep -r "service_role" .next/static` finds nothing, and the only Supabase key in the bundle is the anon key.
