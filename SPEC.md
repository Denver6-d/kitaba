# Spec: English spelling for Arabic speakers — V2 (pivot)

> Status: **pivot, approved by the owner (2026-11-17).** It replaces the V1 spec (typing, spelling, sentences and professional writing). The V1 history stays in git and the pivot is recorded in DECISIONS.md (section "Pivot").
>
> The product name lives in one constant, `src/config/brand.ts`. This document calls the product "the app".

## 1. Objective

The app answers one question for Arabic speakers: **"can I spell English words correctly?"** It does not train typing speed, keyboard layouts, free writing or professional writing.

- **Users:** Arabic-speaking teens and adults, from A1 to C1. They study in short sessions, often on a phone.
- **Promise (honest):** short, game-like spelling practice with instant feedback that names the rule behind each mistake. Mistakes come back on a spaced-repetition schedule. It does not promise fluency. Feedback is rule-based and works without AI.
- **Success looks like:** a guest opens the site and plays the first stage within 10 seconds, with no account. They can come back daily for the streak, the daily challenge and their review queue. An account only adds sync across devices and an optional weekly leaderboard.

### User stories
- As a new visitor, I start the first stage of the campaign immediately, on my phone or my laptop.
- As a learner, I hear a word (American or British voice) and type it. When I'm wrong, I see the correct spelling, my answer with the differences marked, and a one-line rule.
- As a learner, I play short modes (2–5 minutes): Listen and Spell, Spelling Bee, Fix the Mistake, Missing Letters, Word Scramble and Pick the Right Spelling.
- As a learner, I progress through 8 worlds × 10 stages, earn 1–3 stars, unlock the next stage, and beat a boss stage at the end of each world.
- As a returning learner, I keep my daily streak, play the daily challenge and review my own mistakes when they are due.
- As a learner who wants to compete, I opt in to a weekly leaderboard under a nickname and can leave any time.
- As a returning user, I sign in with Google, GitHub or email, my guest progress is merged, and I sync across devices.

## 2. Capability map

| Module | Responsibility |
|---|---|
| `platform` | Next.js shell, i18n (ar/en, RTL), themes, fonts, hamburger menu, PWA, design tokens, brand constant |
| `persistence` | Repository interfaces, Dexie (local, schema v2 with migration), export/import (v1 files are migrated on import) |
| `content` | Validated spelling data: ≥ 1,500 words (A1–C1, 15 categories), each with an Arabic hint and an example sentence; ≥ 800 dictation sentences; rule explanations |
| `spelling` | Answer checking (US/UK variants), letter diff, misspelling generator, rule explanations, SM-2 SRS |
| `games` | Game engine (items, scoring, combo, timer), 7 modes, shuffle-bag selection without repeats |
| `campaign` | 8 worlds × 10 stages, stars, unlocks, bosses, daily challenge |
| `progress` | XP, levels, streaks, daily goal, achievements, stats |
| `accounts` | Supabase auth (Google and GitHub OAuth, email), offline-tolerant sync, first-login merge, sign-out, account deletion |
| `leaderboard` | Opt-in nickname, weekly spelling score, RPC submission with plausibility checks |

## 3. Tech stack (unchanged)

Next.js 16 (App Router), React 19 and strict TypeScript, Tailwind CSS 4, shadcn/ui (Radix), Dexie 4, zod 4, GSAP and `motion` (always respecting reduced motion), lucide-react, and Supabase (`@supabase/supabase-js` and `@supabase/ssr`) when configured. Tests use Vitest with `fake-indexeddb`. **No new dependency without asking the owner.**

## 4. Commands

```
npm run dev | build | start | lint | typecheck | test
npm run validate:content     # content validation script (also covered by the test suite)
```

## 5. Routes

| Route | Purpose |
|---|---|
| `/` | Landing: "master English spelling", a large live game visual, start playing |
| `/play` | Campaign map (worlds and stages), daily challenge, free-play modes |
| `/play/game?stage=w1-s1` | One campaign stage |
| `/play/game?daily=1` | Daily challenge |
| `/play/game?mode=bee&level=B1&category=ie-ei` | Free play in one mode (level and category filters) |
| `/review` | Spaced-repetition review of the learner's own mistakes |
| `/progress` | Stats, streak, XP and level, achievements, weakest categories |
| `/leaderboard` | Weekly spelling score (opt-in) |
| `/account`, `/account/reset`, `/auth/callback` | Optional accounts |
| `/settings`, `/privacy`, `/offline` | Settings, privacy, offline fallback |

Main navigation: Home, Play, Review, My progress. Everything else (Leaderboard, Account, Settings, Privacy, language and theme) sits in a hamburger menu on every screen size. The footer shows only the name and one short line.

## 6. Architecture

`app routes → features (React) → domain (pure) + repositories (interfaces)`. The domain never imports React, the DOM or storage. Time and randomness are injected.

### 6.1 Synced tables (Dexie v2 = cloud `table_name` values)
`srs`, `mastery`, `activity`, `achievements`, `profile`, `sessions` (append-only game results), `stages` (best result per stage; higher stars win on merge, then more points). The v1 tables `results`, `keystats`, `ghosts`, `attempts` and `scenarios` are dropped by the v2 migration. What a learner still needs (SRS cards, spelling mastery, streak days, XP, achievements that still exist, the daily goal) is kept. One pure function, `migrateV1Tables`, does this for the Dexie upgrade and for importing v1 export files.

### 6.2 Answer checking
Answers are compared after trimming and lower-casing, with curly apostrophes made straight. A word with a British/American pair accepts the variant chosen in settings, and accepts the other one with a note. In the `british-american` category, the learner must type the variant they are asked for. Feedback shows a letter-level diff and the category's one-line rule (ar/en), plus a word-specific tip when one exists.

### 6.3 Selection without repetition
A shuffle-bag per pool (pool key = mode, filters and level) is kept locally in the `meta` table (not synced). Items are drawn without replacement, so nothing repeats until the pool is exhausted. On a refill, the last `min(10, pool/2)` items drawn are moved to the back so the seam never repeats either.

### 6.4 Games
One engine (`domain/games/engine.ts`) handles the item list, answers, points (10 per correct answer, plus a speed bonus in timed modes), combo multiplier (×1, ×2 after 3 in a row, ×3 after 6, ×4 after 10; reset on a miss), timer and result. Modes only supply item builders and an answer type (typed or choice).

| Mode | Item | Answer |
|---|---|---|
| Listen and Spell | spoken word (homophones spoken with their example sentence) | typed |
| Spelling Bee | spoken word, 60 s round, combo multiplier | typed |
| Fix the Mistake | example sentence with one misspelled word | tap the wrong word, then type the fix |
| Missing Letters | word with the tricky letters blanked | typed (full word) |
| Word Scramble | shuffled letters plus the Arabic hint | typed |
| Pick the Right Spelling | 4 options (1 correct, 3 rule-based misspellings), quick-fire | choice |
| Review | SRS-due words from the learner's own mistakes | typed |
| Mixed (boss, daily) | items from several modes, including whole dictated sentences in bosses | typed, choice |

Sessions take 2–5 minutes (8–12 items, or a 60 s round). Stars: 1 at ≥ 60% correct, 2 at ≥ 80%, 3 at ≥ 95%. The boss needs ≥ 70% for 1 star. The next stage unlocks at 1 star; the next world unlocks when its boss is cleared. The daily challenge is a seeded mix of 10 items per local day.

### 6.5 Supabase
Unchanged in principle (DECISIONS A1–A8, L1–L6): RLS on every table, writes only through `SECURITY DEFINER` RPCs, and no service_role key anywhere. OAuth (Google, GitHub) uses `signInWithOAuth` with PKCE. The `redirectTo` is built from the current origin plus `/auth/callback`, and the `next` path is validated by `safeNext`. Provider client IDs and secrets live only in the Supabase dashboard.

Leaderboard: `submit_score(p_points, p_correct, p_total, p_duration_s)` checks opt-in, 5 ≤ total ≤ 60, correct ≤ total, accuracy ≥ 50%, points ≤ correct × 40, duration ≥ 2 s per item, ≤ 1 per 20 s and ≤ 60 per day. The public view `leaderboard_weekly` exposes `rank, nickname, points, words, last_at` (weekly sum, Monday 00:00 UTC).

## 7. Acceptance criteria
1. The removed V1 features have no route, navigation entry, module or test left.
2. The first character typed in any input is always kept, including the first keystroke of a timed round and the first keystroke on a new item (regression test).
3. Content: ≥ 1,500 unique words, all 15 categories, all 5 levels, ≥ 800 unique dictation sentences. Every word has an Arabic hint and an example that contains it. Validated by `npm run validate:content` and the test suite.
4. Seven modes, 80 campaign stages with stars and unlocks, 8 bosses, a daily challenge, XP and levels, a streak.
5. Spelling inputs: `autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false"`, the right `inputmode`, and they stay visible above the virtual keyboard.
6. Hamburger menu: keyboard accessible, focus trapped, closes on Esc and on an outside click, RTL and LTR.
7. Usable at 360, 390, 768, 1280 and 1920 px, in both themes and both directions, with no horizontal scroll and touch targets ≥ 44 px.
8. Guest mode works with no Supabase env vars, offline after the first visit, with no console errors.
9. lint, typecheck, test and build are green at every phase commit.

## 8. Boundaries
- **Always:** keep domain logic pure and tested; use logical CSS properties; keep English answer areas `dir="ltr" lang="en"`; respect reduced motion; validate external input with zod; write original content only.
- **Ask first:** any new dependency; adding a git remote or pushing.
- **Never:** a service_role key or provider secret in the repo or client; analytics or tracking; AI APIs; content copied from copyrighted books or word lists; sounds on by default.

## 9. Out of scope
Typing speed, keyboard layouts, free-writing grading, professional writing, Apple sign-in (needs a paid account), teacher or class mode, recorded audio (speech is Web Speech only).
