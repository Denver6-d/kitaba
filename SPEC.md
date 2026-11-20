# Spec: English spelling for Arabic speakers — V2 (pivot)

> Status: **pivot, approved by the owner (2026-11-17).** It replaces the V1 spec (typing, spelling, sentences and professional writing). The V1 history stays in git and the pivot is recorded in DECISIONS.md (section "Pivot").
>
> The product name lives in one constant, `src/config/brand.ts`. This document calls the product "the app".

## 1. Objective

The app answers one question for Arabic speakers: **"can I spell English words correctly?"** It covers single words and, since phase F, the spelling of whole sentences and messages. It does not train typing speed or keyboard layouts, and it never checks grammar or style.

- **Users:** Arabic-speaking teens and adults, from A1 to C1. They study in short sessions, often on a phone.
- **Promise (honest):** short, game-like spelling practice with instant feedback that names the rule behind each mistake. Mistakes come back on a spaced-repetition schedule. It does not promise fluency. Feedback is rule-based and works without AI.
- **Success looks like:** a guest opens the site and plays the first stage within 10 seconds, with no account. They can come back daily for the streak, the daily challenge and their review queue. An account only adds sync across devices and an optional weekly leaderboard.

### User stories
- As a new visitor, I start the first stage of the campaign immediately, on my phone or my laptop.
- As a learner, I hear a word (American or British voice) and type it. When I'm wrong, I see the correct spelling, my answer with the differences marked, and a one-line rule.
- As a learner, I play short modes (2–5 minutes): Listen and Spell, Spelling Bee, Fix the Mistake, Missing Letters, Word Scramble and Pick the Right Spelling.
- As a learner, I progress through 8 worlds × 10 stages, earn 1–3 stars, unlock the next stage, and beat a boss stage at the end of each world.
- As a new visitor, I choose my level (A1–C1) or take a 3-minute placement test, or skip and start at A2.
- As a learner, I change my words, sentences and tests levels at any time on the Play page, and the next game uses them.
- As a learner, I write a short message or paragraph for an Arabic scenario. Every misspelled word is highlighted, and I see the right spelling and a short Arabic reason.
- As a learner, I hear a sentence or a longer message read one sentence at a time, type it, and see a word-by-word comparison.
- As a returning learner, I keep my daily streak, play the daily challenge and review my own mistakes when they are due.
- As a learner who wants to compete, I opt in to a weekly leaderboard under a nickname and can leave any time.
- As a returning user, I sign in with email (or Google, once it is switched on), my guest progress is merged, and I sync across devices.

## 2. Capability map

| Module | Responsibility |
|---|---|
| `platform` | Next.js shell, i18n (ar/en, RTL), dark-only design tokens, fonts, hamburger menu, PWA, design tokens, brand constant |
| `persistence` | Repository interfaces, Dexie (local, schema v3 with migrations), export/import (v1 and v2 files are migrated on import) |
| `content` | Validated spelling data: the bundled hand-written bank (1,591 words, see DECISIONS C1; each with an Arabic hint and an example sentence; ≥ 800 dictation sentences; rule explanations) plus the open-data library in `public/content/v1` (≥ 8,000 more graded and categorised words, DECISIONS OD5–OD7), loaded on demand. Counts are never shown on the site |
| `spelling` | Answer checking (US/UK variants), letter diff, misspelling generator, rule explanations, SM-2 SRS |
| `games` | Game engine (items, scoring, combo, timer), 7 modes, shuffle-bag selection without repeats |
| `campaign` | 8 worlds × 10 stages, stars, unlocks, bosses, daily challenge |
| `levels` | Three stored learner levels (words, sentences/messages, tests), first-visit welcome, adaptive placement test (§6.6) |
| `progress` | XP, levels, streaks, daily goal, achievements, stats |
| `accounts` | Supabase auth (Google OAuth behind `NEXT_PUBLIC_ENABLE_GOOGLE_SIGNIN`, email), offline-tolerant sync, first-login merge, sign-out, account deletion |
| `leaderboard` | Opt-in nickname, weekly spelling score, RPC submission with plausibility checks |
| `writing` | Sentences and messages (§6.7): free writing with an on-device spell checker, sentence and message dictation, mistakes to SM-2, history |

## 3. Tech stack (unchanged)

Next.js 16 (App Router), React 19 and strict TypeScript, Tailwind CSS 4, shadcn/ui (Radix), Dexie 4, zod 4, `motion` (always respecting reduced motion; GSAP and Lenis were removed, DECISIONS N5), lucide-react, and Supabase (`@supabase/supabase-js` and `@supabase/ssr`) when configured. Tests use Vitest with `fake-indexeddb`. Phase F added one spell-check dependency, approved in the owner's brief: `nspell@2.1.5` with the `dictionary-en@4.0.0` data (DECISIONS F1). **No other new dependency without asking the owner.**

## 4. Commands

```
npm run dev | build | start | lint | typecheck | test
npm run validate:content     # content validation script (also covered by the test suite)
npm run content:build        # open-data pipeline (dev-only, resumable; see DECISIONS "Open data")
npm run check:bundle         # after build: first-load JS per page, budget and placement checks (OD14)
```

## 5. Routes

| Route | Purpose |
|---|---|
| `/` | Landing: "master English spelling", a large live game visual, start playing |
| `/play` | Campaign map (worlds and stages), daily challenge, free-play modes |
| `/play/game?stage=w1-s1` | One campaign stage |
| `/play/game?daily=1` | Daily challenge |
| `/play/game?mode=bee&level=B1&category=ie-ei` | Free play in one mode (level and category filters) |
| `/welcome`, `/welcome?test=1` | First visit: choose a level, take the placement test, or skip; `?test=1` retakes the test (linked from settings) |
| `/write` | Sentences and messages: choose free writing or dictation, set the sentences level |
| `/write/free` | Free writing for an Arabic scenario, spell-checked on the device |
| `/write/dictation` | Dictation of whole sentences and longer messages |
| `/review` | Spaced-repetition review of the learner's own mistakes |
| `/progress` | Stats, streak, XP and level, achievements, weakest categories |
| `/leaderboard` | Weekly spelling score (opt-in) |
| `/account`, `/account/reset`, `/auth/callback` | Optional accounts |
| `/settings`, `/privacy`, `/offline` | Settings (including "the full library offline"), privacy, offline fallback |
| `/credits` | Open-data sources, licences, reproduced notices, Tatoeba author list |

Main navigation: Home, Play, Sentences, Review, My progress. Everything else (Leaderboard, Account, Settings, Privacy, Open data credits and language) sits in a hamburger menu on every screen size. The footer shows only the name and one short line.

## 6. Architecture

`app routes → features (React) → domain (pure) + repositories (interfaces)`. The domain never imports React, the DOM or storage. Time and randomness are injected.

### 6.1 Synced tables (Dexie v4 = cloud `table_name` values)
`srs`, `mastery`, `activity`, `achievements`, `profile`, `sessions` (append-only game results), `stages` (best result per stage; higher stars win on merge, then more points), `writings` (append-only free-writing and dictation history) and `dictionary` (the learner's own words; removal is a tombstone). The last two arrive with Dexie v4 and the Supabase migration `20261118000001_writing.sql`. The v1 tables `results`, `keystats`, `ghosts`, `attempts` and `scenarios` are dropped by the v2 migration. What a learner still needs (SRS cards, spelling mastery, streak days, XP, achievements that still exist, the daily goal) is kept. One pure function, `migrateV1Tables`, does this for the Dexie upgrade and for importing v1 export files.

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

### 6.6 Learner levels and placement (phase E)
The profile stores three levels (`levels: { words, sentences, tests }`, each A1–C1), how they were set (`levelSource`: `choice`, `placement`, `skip`, or `null` before the first choice) and when (`levelsAt`). They sync with the profile (last write wins).

| Level | Drives |
|---|---|
| words | free play and the nine normal stages of every world |
| sentences | free writing and sentence/message dictation (phase F) |
| tests | the daily challenge and every boss stage |

A session reads the profile each time it is built, so a change on the Play page applies to the very next game. A stage draws from its world's categories **at the learner's level**. It widens to the nearest levels (one below, one above, …) only when fewer words than the stage needs remain. The shuffle-bag key includes the levels used, so a change starts a fresh pass. The game header shows the session's level.

On the first visit (`levelSource = null`), any page except `/welcome`, privacy, credits, offline, auth and sign-in sends the learner to `/welcome?next=<that page>`, without showing the page first, and returns them there afterwards (DECISIONS L1). "Test my level" is the primary action. There they can choose a level (each comes with a one-line Arabic description), take the placement test, or skip (A2). A signed-in learner on a new device is redirected only after the first sync, so a level stored in the account is not asked for again.

The placement test is 16 "pick the right spelling" items (about 3 minutes). It is adaptive: a staircase moves up after a right answer and down after a wrong one, and the step halves at each reversal. It ends with the level and a one-line explanation. Its result, or the chosen level, sets all three levels. Settings offer "retake the placement test".

Dexie v3 and export v3 reshape the profile. v2 rows (with one `level`) are migrated by one pure function, `migrateProfileRow`. It runs in the Dexie upgrade, on file import, and on cloud rows from older clients.

### 6.7 Sentences and messages (phase F, spelling only)
- **Content** (`src/data/writing`, original, zod-validated): 150 free-writing scenarios (30 per level; an Arabic prompt with an English version; kinds: sentence, message, email, paragraph; a suggested length), 300 dictation sentences (A1 60, A2 70, B1 70, B2 55, C1 45) and 60 longer messages (12 per level, 4–5 sentences each). Items are drawn from a shuffle-bag per level, so nothing repeats until the pool is used up.
- **Free writing:** the learner writes in a large textarea (autocorrect, autocapitalise and the browser's spell check off; `dir="ltr" lang="en"`; the action bar stays above the phone keyboard). "Check" runs the checker in a Web Worker.
- **Checker** (`domain/writing`, pure; the dictionary is injected):
  - Hunspell en-US dictionary via nspell, loaded lazily on the writing pages only.
  - Rule-based common confusables (your/you're, their/there/they're, its/it's, to/too, then/than, lose/loose, affect/effect, accept/except, quite/quiet, were/where, could of).
  - British spellings recognised by rule and accepted with a note.
  - Names, numbers, acronyms, e-mail addresses and URLs are skipped. Capitalised unknown words inside a sentence are names, except misspelled days and months.
  - Learners can add a word to their own dictionary. This rescores the text, amends the saved record and removes the review card that check created. Checking unchanged text again earns nothing new.
  - Every flagged word gets a type (double letter, ie/ei, silent letter, vowel, p/b, v/f, confusable, British/American, apostrophe, capital, letter order, ending, two words, other) with a one-line Arabic explanation.
  - It never claims to check grammar.
- **Dictation:** on-device speech (en-US/en-GB from settings), normal or slow speed, replay, and sentence by sentence for messages (plus "listen to the whole message"). Without a voice, the learner can show and hide the current sentence. The answer is compared word by word (case and punctuation ignored; a hyphen equals a space; the other spelling variant is accepted), with misspellings paired with the intended word, plus missing and extra words. Accuracy is correct words / (words in the text + extra words).
- **Feedback:** tap a highlighted word to see the right spelling with a letter diff, the reason, a listen button, an example, and "add to my dictionary". The summary shows spelling accuracy, mistakes by type, words to practise, stars (1 at ≥ 60%, 2 at ≥ 80%, 3 at ≥ 95%, at least 3 words) and XP (1 per correct word up to 60, plus 5 per star), with the stage-clear celebration.
- **Review:** each misspelled word gets an SM-2 card. It reuses the bank card when the word is in the bank, or gets an `x-<word>` card noting the sentence it came from. Review plays both kinds.
- **History:** "My progress" lists the last 20 texts with accuracy and mistakes.

### 6.5 Supabase
Unchanged in principle (DECISIONS A1–A8, L1–L6): RLS on every table, writes only through `SECURITY DEFINER` RPCs, and no service_role key anywhere. Google OAuth uses `signInWithOAuth` with PKCE. The `redirectTo` is built from the current origin plus `/auth/callback`, and the `next` path is validated by `safeNext`. Provider client IDs and secrets live only in the Supabase dashboard.

Leaderboard: `submit_score(p_points, p_correct, p_total, p_duration_s)` checks opt-in, 5 ≤ total ≤ 60, correct ≤ total, accuracy ≥ 50%, points ≤ correct × 40, duration ≥ 2 s per item, ≤ 1 per 20 s and ≤ 60 per day. The public view `leaderboard_weekly` exposes `rank, nickname, points, words, last_at` (weekly sum, Monday 00:00 UTC).

## 7. Acceptance criteria
1. The removed V1 features have no route, navigation entry, module or test left.
2. The first character typed in any input is always kept, including the first keystroke of a timed round and the first keystroke on a new item (regression test).
3. Content: ≥ 1,500 unique words, all 15 categories, all 5 levels, ≥ 800 unique dictation sentences. Every word has an Arabic hint and an example that contains it. Validated by `npm run validate:content` and the test suite.
4a. The levels chosen on the Play page (words, sentences, tests) are stored, read by every session build, and take effect in the next game (regression tests in `tests/features/build-session.test.ts`).
4. Seven modes, 80 campaign stages with stars and unlocks, 8 bosses, a daily challenge, XP and levels, a streak.
5. Spelling inputs: `autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false"`, the right `inputmode`, and they stay visible above the virtual keyboard.
6. Hamburger menu: keyboard accessible, focus trapped, closes on Esc and on an outside click, RTL and LTR.
7. Usable at 360, 390, 768, 1280 and 1440 px (dark only, DECISIONS R1), in both directions, with no horizontal scroll and touch targets ≥ 44 px.
7a. Sentences and messages: ≥ 150 scenarios, ≥ 300 dictation sentences and ≥ 60 messages, original and unique, every text spell-checks clean with the real dictionary (content test). The checker is covered by tests for known misspellings, confusables, false positives (names, numbers, acronyms, apostrophes, hyphens) and British spellings, and the dictation diff by its own tests. nspell and the dictionary are not in the main bundle.
8. Guest mode works with no Supabase env vars, offline after the first visit, with no console errors.
9. lint, typecheck, test and build are green at every phase commit.

## 8. Boundaries
- **Always:** keep domain logic pure and tested; use logical CSS properties; keep English answer areas `dir="ltr" lang="en"`; respect reduced motion; validate external input with zod; write original content only.
- **Ask first:** any new dependency; adding a git remote or pushing.
- **Never:** a service_role key or provider secret in the repo or client; analytics or tracking; AI APIs; sending a learner's text anywhere; claiming to check grammar; content copied from copyrighted books or word lists; sounds on by default.

## 9. Out of scope
Typing speed, keyboard layouts, grammar or style checking (the writing section checks spelling and a few rule-based confusables only), professional-writing checklists, Apple sign-in (needs a paid account), teacher or class mode, recorded audio (speech is Web Speech only).
