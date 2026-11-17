# Kitaba (كتابة)

English writing practice for Arabic speakers (A1–B1): typing speed and accuracy, spelling, sentence writing and professional writing. Arabic-first UI (RTL) with an English toggle.

Kitaba trains *writing skills*. It does not promise fluency, and its feedback comes from rules that run in the browser, not from a tutor or an AI.

- **Guest-first:** every exercise works with no account and offline after the first visit. Progress is stored in IndexedDB on the device.
- **Optional account:** adds cloud sync across devices (Supabase) and an opt-in public leaderboard.
- **No analytics, no tracking, no AI APIs.** The only network calls are to Supabase, and only when it is configured.

See [SPEC.md](SPEC.md) for the specification, [DESIGN.md](DESIGN.md) for the design system and [DECISIONS.md](DECISIONS.md) for every choice made while building.

## Features

| Area | What it does |
|---|---|
| Typing | 15/30/60 s tests (words or sentences). Live WPM, accuracy and consistency, personal bests and a ghost race. An Arabic-layout detector shows a hint instead of a wall of typos. Per-key heatmap, adaptive drills for weak keys, foundation lessons and custom text. |
| Diagnostic | About 2 minutes of typing, dictation and sentences. Gives a starting level (A1/A2/B1) and a personal plan. |
| Spelling | Dictation with on-device voices (Web Speech). SM-2 spaced repetition for misspelled words, with a "due today" queue. |
| Sentences | Translate Arabic → English. A word-level diff, with errors classified and explained in Arabic and English. The grader is a heuristic, not a grammar checker. |
| Professional | Eight or more scenarios (emails, applications, messages). A form checklist and a model answer side by side. |
| Progress | History chart, streak, daily goal, levels, achievements, a printable certificate and a share image. |
| Accounts | Email and password, magic link and password reset. Offline-tolerant sync, merge on first sign-in, export, and account deletion. |
| Leaderboard | Opt-in with a nickname. Weekly and all-time boards, server-side plausibility checks and rate limits. Leave at any time. |
| Platform | Light and dark themes, text size 90–140%, a reading-friendly font, optional key-click sounds, reduced motion and an installable PWA. |

## Getting started

Requires Node.js 20.9 or later.

```
npm install
npm run dev          # http://localhost:3000
```

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm run start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) |
| `npm test` | Vitest: domain logic, repositories contract, sync engine and content validator |

The service worker is registered in production builds only (`npm run build && npm run start`).

## Optional: accounts, sync and leaderboard (Supabase)

Without configuration, the app runs in guest mode. The account page says that accounts are not set up, and nothing else changes.

1. Create a Supabase project.
2. In the SQL editor, run the migrations in order:
   - `supabase/migrations/20261117000001_progress.sql` (sync table, RLS, `upsert_progress`, `delete_my_account`);
   - `supabase/migrations/20261117000002_leaderboard.sql` (leaderboard tables, public views, RPCs).
3. Run `supabase/tests/rls_tests.sql` in the SQL editor. It runs inside a transaction that is rolled back, and prints `ALL RLS TESTS PASSED` if everything holds. Then go through `supabase/tests/rls_checklist.md`.
4. Under Authentication → URL configuration, set the Site URL and add `https://<your-site>/auth/callback` to the redirect URLs.
5. Copy `.env.example` to `.env.local` and set the two public values from Project Settings → API:
   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   ```

Only the public anon key is used. **Never put a `service_role` key in this app:** account deletion works through a `SECURITY DEFINER` function that can only delete the caller.

## Architecture

```
src/app            routes (thin)
src/features       React feature components and hooks
src/domain         pure TypeScript: typing engine, metrics, SRS, grader, merge rules, leaderboard rules
src/repositories   interfaces + RecordStore backends (Dexie, in-memory, Supabase), outbox
src/data           curated content with zod schemas
supabase/          migrations and RLS tests
tests/             Vitest suites (mirror src/domain, repositories, sync, data)
```

- The domain layer has no React, DOM or storage imports. Time and randomness are injected.
- The UI always reads local data. When signed in, writes also go to an outbox that a sync engine pushes and pulls. Conflicts are resolved last-write-wins per record (append-only data merges by union). See DECISIONS A1–A8.
- Leaderboard scores are reported by the browser and checked for plausibility on the server. They cannot be made fully cheat-proof, and the UI says so (DECISIONS L1–L6).

## Privacy

The `/privacy` page (Arabic and English) lists exactly what is stored on the device and in the cloud, what is public on the leaderboard (nickname, best speed, accuracy and date only), and how to delete everything.

## Licence of content

All practice content (words, sentences, scenarios, lessons) was written for this project.
