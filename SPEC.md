# Spec: Kitaba (working name) — V1

> Status: **draft, awaiting approval**. No app code exists yet.

## 1. Objective

Kitaba is a web platform that helps **Arabic speakers master English writing**: typing speed and accuracy, spelling, sentence writing, and professional writing.

- **Users:** Arabic-speaking teenagers and adults (A1–B1 English) who are used to the Arabic keyboard layout and need to write English for study or work.
- **Promise (honest):** Kitaba trains *writing skills*: typing, spelling, sentence construction and professional conventions. It does **not** guarantee fluency, and its feedback is rule-based, not a human or AI tutor. The UI copy says this plainly.
- **Pedagogy:** phrases and full sentences come before isolated words. Content is tagged A1 / A2 / B1. Arabic hints are visible at first and fade as the learner's mastery of an item grows (per-item hint level 2 → 1 → 0).
- **Success looks like:** a guest can arrive, take a 2-minute diagnostic, get a plan and a starting level, and practise all four skills fully offline with no account. An account only adds cross-device sync and an optional public leaderboard.

### User stories (abridged)
- As a new visitor, I take a diagnostic and receive a starting level and a personal plan.
- As a learner, I take 15/30/60 s typing tests and see live WPM, accuracy and consistency, then a results screen and my personal bests.
- As a learner whose Arabic layout is still active, I see an Arabic hint ("لوحة المفاتيح العربية مفعّلة، اضغط Alt+Shift") instead of a wall of typos.
- As a learner, I see a keyboard heatmap of my weakest keys and drill them adaptively.
- As a learner, I hear a word and type it; words I miss come back on an SM-2 schedule.
- As a learner, I translate an Arabic sentence into English and get a word-level diff with classified errors explained in Arabic and English.
- As a job seeker, I write a professional email and get a checklist and a model answer to compare.
- As a returning user, I optionally sign in, merge my local progress, and sync across devices.
- As a competitive user, I opt in to a leaderboard under a nickname and can leave it any time.

## 2. Capability map

The request bundles several capabilities. The user asked for one spec and one approval gate, so they are recorded here as modules inside a single SPEC.md, built in this order.

| Module id | Responsibility | Depends on |
|---|---|---|
| `platform` | Next.js shell, i18n (ar/en, RTL), themes, fonts, a11y settings, PWA, design tokens | — |
| `persistence` | Repository interfaces + Dexie (local) implementation, export/import | platform |
| `content` | Validated data: words, sentences, scenarios, lessons (zod schemas) | — |
| `typing` | Typing engine, layout detector, key stats, heatmap, adaptive drills, ghost, lessons, custom text | persistence, content |
| `diagnostic` | First-visit diagnostic → level + plan | typing, spelling, sentences |
| `stats` | History chart (SVG), streak, daily goal, levels | persistence |
| `spelling` | Dictation (Web Speech), SM-2 SRS, review queue | persistence, content |
| `sentences` | Rule-based grader + error classifier, sentence practice | persistence, content |
| `professional` | Scenario checklist + model answers | content |
| `rewards` | Achievements, certificate (print CSS), share image (canvas) | stats |
| `accounts` | Supabase auth, Supabase repositories, merge, offline sync queue | persistence |
| `leaderboard` | Opt-in nickname, RPC submission, public view | accounts |

Build order: platform → content, persistence → typing → stats → spelling → sentences → diagnostic → professional → rewards → accounts → leaderboard.

Delivery phases (one git commit each): **P1** typing core (platform, persistence, typing, diagnostic, custom text, stats) · **P2** spelling · **P3** sentences, professional, rewards · **P4** accounts and sync · **P5** leaderboard.

## 3. Tech stack (pinned at install time; latest stable as of this spec)

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript strict (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) |
| Styling | Tailwind CSS 4 with CSS-variable design tokens; logical properties only (`ms-*`, `pe-*`, `start-*`); shadcn/ui (Radix) for dialogs, menus, tabs, switches |
| Local storage | Dexie 4 (versioned schema), JSON export/import |
| Validation | zod 4 (content files, import files, forms, nickname) |
| i18n | Small hand-written typed dictionary (`ar`, `en`); see Decision D1 |
| Motion | GSAP 3 + ScrollTrigger and Lenis on the **landing page only**; `motion` for small UI transitions; all disabled under `prefers-reduced-motion` |
| Icons | lucide-react |
| Backend (optional) | Supabase via `@supabase/supabase-js` + `@supabase/ssr`; only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Tests | Vitest (+ `fake-indexeddb` *only if approved*, see Open Questions) |
| Fonts (next/font) | Latin display + sans pairing, Cairo (Arabic), a monospace for typing, Atkinson Hyperlegible or OpenDyslexic-style option for dyslexia (final pick recorded in DESIGN.md) |

No analytics, no tracking, no third-party network calls except Google Fonts (self-hosted by next/font at build time, so there are no runtime calls) and Supabase when it is configured.

## 4. Commands

```
npm install
npm run dev          # http://localhost:3000
npm run build        # production build
npm run start        # serve the production build
npm run lint         # ESLint (next config)
npm run typecheck    # tsc --noEmit
npm test             # vitest run
npm run test:watch   # vitest
```

## 5. Project structure

```
src/
  app/                    Next.js routes (thin: compose features, no logic)
    (marketing)/page.tsx  Landing (hero typing demo, GSAP story)
    test/                 Typing test + results
    learn/                Foundation lessons, adaptive drills
    custom/               Custom text practice
    diagnostic/
    spelling/             Dictation + "due today" review
    sentences/
    professional/
    stats/  achievements/  certificate/
    account/              Auth, merge, export, delete
    leaderboard/
    privacy/  settings/
  domain/                 PURE TypeScript. No React, DOM, Dexie or Supabase imports.
    typing/               engine.ts, metrics.ts, layout-detector.ts, key-stats.ts, adaptive.ts, ghost.ts
    spelling/             srs.ts (SM-2), dictation.ts
    sentences/            normalize.ts, diff.ts, grader.ts, classifier.ts
    professional/         checklist.ts
    progress/             levels.ts, streak.ts, achievements.ts, diagnostic.ts, plan.ts
    sync/                 merge.ts (LWW rules), queue.ts
    leaderboard/          nickname.ts, plausibility.ts
  data/                   Content as typed TS/JSON + zod schemas
    words.ts  sentences.ts  scenarios.ts  lessons.ts  schema.ts
  repositories/
    types.ts              ProgressRepository, WordRepository, SettingsRepository, …
    local/                Dexie implementations
    supabase/             Supabase implementations
    provider.tsx          Selects the implementation; UI only sees interfaces
  features/               React feature components (typing-test, heatmap, dictation, …)
  components/ui/          shadcn primitives + design-system components
  lib/                    i18n, audio (Web Audio clicks), speech, canvas share, supabase client
  styles/                 tokens.css, globals.css, print.css
public/                   manifest.webmanifest, sw.js, icons
supabase/migrations/      0001_schema.sql, 0002_rls.sql, 0003_leaderboard.sql
supabase/tests/           RLS checklist + SQL test script
tests/                    Vitest: mirrors src/domain, repositories, data
SPEC.md DESIGN.md DECISIONS.md README.md tasks/plan.md tasks/todo.md
```

## 6. Architecture

### 6.1 Layers
`app routes → features (React) → domain (pure) + repositories (interfaces)`. Domain never imports UI or storage. Features receive repositories through a React context and never import `local/` or `supabase/` directly.

### 6.2 Repository interfaces (contract)

```ts
export interface ProgressRepository {
  saveTestResult(r: TestResult): Promise<void>;
  listTestResults(q?: { since?: number; limit?: number }): Promise<TestResult[]>;
  getPersonalBests(): Promise<PersonalBests>;
  getKeyStats(): Promise<KeyStats>;
  mergeKeyStats(delta: KeyStats): Promise<void>;
  getBestRun(mode: TestMode): Promise<GhostRun | null>;
}
export interface WordRepository {           // spelling SRS cards
  getCard(wordId: string): Promise<SrsCard | null>;
  upsertCard(card: SrsCard): Promise<void>;
  listDue(now: number): Promise<SrsCard[]>;
}
export interface SentenceRepository { recordAttempt(a: SentenceAttempt): Promise<void>; listAttempts(): Promise<SentenceAttempt[]>; }
export interface ProfileRepository { getProfile(): Promise<Profile>; saveProfile(p: Profile): Promise<void>; } // level, plan, goal, streak, hint levels, achievements
export interface SettingsRepository { get(): Promise<Settings>; save(s: Settings): Promise<void>; }      // local only, never synced
export interface LeaderboardRepository { submit(s: ScoreSubmission): Promise<SubmitResult>; top(board: 'weekly' | 'all'): Promise<PublicScore[]>; setNickname(n: string | null): Promise<void>; }
```

Every synced record carries `id` (UUID), `updatedAt` (ms epoch), and `deletedAt?` (tombstone). A shared contract test suite (`tests/repositories/contract.ts`) runs against the local implementation and an in-memory fake. The Supabase implementation is checked against the same contract manually, since tests make no network calls.

### 6.3 Sync model (P4)
- Local Dexie is always the source the UI reads. When signed in, writes also go to an `outbox` table.
- A sync worker flushes the outbox when online (`navigator.onLine`, the `online` event, and a retry with backoff), then pulls remote rows changed since the last cursor.
- **Conflict rule: last-write-wins per record by `updatedAt`, tie → remote wins** (deterministic). Append-only records (test results, attempts) merge by union on `id`. Key stats merge by summing per-key counters, deduplicated by contributing result id. This is pure (`domain/sync/merge.ts`) and unit-tested.
- **First sign-in:** if local data exists, a dialog offers "Merge my local progress into this account" or "Keep them separate (use the account's data on this device; local data is exported first)". Nothing is overwritten silently.
- Status indicator: `offline · pending N` / `syncing` / `synced` / `error (retry)`.

### 6.4 Supabase (P4–P5)
- Missing env vars → `isSupabaseConfigured = false` → no client is created, account UI shows "Accounts are not configured on this site", and the app runs as a guest with zero console errors.
- Auth: email + password, magic link, password reset, sign out. **Delete account**: a `security definer` RPC `delete_my_account()` that deletes `auth.uid()`'s rows and the auth user, so no service_role key is needed anywhere. **Export**: JSON download of the local and remote data.
- Every table has RLS enabled with `user_id = auth.uid()` policies for select/insert/update/delete.
- Leaderboard: `leaderboard_profiles(user_id, nickname, opted_in)`, `leaderboard_scores`. The client cannot insert directly (no insert policy). It writes only through `submit_score(wpm, accuracy, duration_s, chars)` (security definer), which checks opt-in, accuracy ≥ 90 %, duration ≥ 30 s, WPM ≤ 250, consistency between chars/duration and WPM, and a rate limit (≤ 1 per 20 s and ≤ 60 per day per user). Public read is through views `leaderboard_weekly` / `leaderboard_all_time` that expose only `nickname, wpm, accuracy, achieved_at`.
- Honest copy: "Scores are reported by your browser and checked for plausibility, but they cannot be made fully cheat-proof."

### 6.5 Key domain algorithms
- **WPM** = (correct chars / 5) / minutes; **raw WPM** includes errors; **accuracy** = correct keystrokes / total keystrokes (corrected errors still count against accuracy); **consistency** = `max(0, 100 × (1 − CV))` of per-second WPM samples.
- **Layout detector:** a keystroke whose `event.key` is an Arabic code point while the expected char is Latin is flagged as `layout-mismatch`. `event.code` maps it to the intended Latin key (`KeyH` → `h`). After 2 consecutive mismatches the test pauses and shows the Arabic hint. Mismatches are excluded from accuracy and key stats.
- **Adaptive drills:** key weakness = smoothed error rate × recency weight; drills are generated from real words and phrases that are dense in the weakest 3–5 keys.
- **SRS:** SM-2 (ease ≥ 1.3, quality 0–5 derived from correctness, attempts and hint use).
- **Sentence grader:** normalize (case, curly → straight apostrophes, punctuation, whitespace, contractions are equivalent: `I'm` ≡ `I am`) → token-level Levenshtein alignment against each accepted answer → pick the minimum edit cost → classify each edit with ordered rules (article, to-be, preposition, verb form/tense, plural, word order via swap detection, spelling via char distance ≤ 2, missing/extra word). It is **heuristic, not a grammar checker**, and DECISIONS.md says so.

## 7. Features and acceptance criteria

### Phase 1 — Typing core
1. **Typing tests** 15/30/60 s × {words, sentences}: live WPM, accuracy and consistency; results screen with animated counters; personal bests per mode; the new-PB celebration is calm (no confetti).
2. **Layout detector:** the Arabic hint appears within 2 keystrokes when the Arabic layout is active; mismatches never appear as typos.
3. **Per-key stats + SVG heatmap** (QWERTY, colour and text label for a11y); **adaptive mode** drills weak keys; **foundation lessons** (home row → rows → numbers/punctuation), with notes aimed at users of the Arabic layout.
4. **Ghost race:** a caret replay of the best run for the same mode, toggleable.
5. **Diagnostic** (~2 min): 60 s typing + 10 dictation/spelling words + 3 sentences → level A1/A2/B1 + a personal plan (ordered focus areas). Offered on the first visit; skippable; repeatable.
6. **Custom text:** paste ≤ 2000 chars (validated, normalized, non-Latin stripped with a notice).
7. **Stats:** SVG WPM history line chart, accuracy, streak, daily goal (minutes), level, with empty states.

### Phase 2 — Spelling
8. **Dictation** with Web Speech (`en-*` voice, rate control, replay); if there is no English voice, a clear message plus a fallback that shows the word briefly and then hides it. Word bank ≥ 200 words, each with a category: `vowel-confusion`, `double-letters`, `silent-letters`, `p-b`, `v-f`, `homophones`, `suffixes`, `ie-ei`, `schwa`, `consonant-clusters`, ….
9. **SRS** SM-2 with a "due today" screen and a count badge.

### Phase 3 — Sentences and professional writing
10. **Sentence writing:** ≥ 150 curated sentences (A1–B1), each with ≥ 1 accepted answer (most have several); word-level diff; classified errors with ar/en explanations; hints fade by mastery.
11. **Professional track:** ≥ 8 scenarios (manager email, job application, LinkedIn message, customer reply, polite follow-up, apology, meeting request, thank-you note). The checklist covers greeting, closing, polite phrases, capitalization, end punctuation, length range, plus scenario-specific must-mentions. The user can compare with a model answer side by side.
12. **Achievements** (pure rule set), **certificate page** (print CSS, A4 landscape, ar/en), **share image** (canvas 1200×630 PNG, Web Share API or download).

### Phase 4 — Accounts and sync (§6.3–6.4). Privacy page (ar/en) lists exactly what is stored, locally and in the cloud, states that there is no analytics, and explains deletion.

### Phase 5 — Leaderboard (§6.4). Nickname: 3–20 chars, `[A-Za-z0-9_\- ]` plus Arabic letters, with a basic blocked-word list (normalized for leetspeak). Users can change their nickname or leave the board any time; leaving deletes their scores from the board.

### Cross-cutting
- Arabic default (`<html lang="ar" dir="rtl">`), English toggle; typing surfaces are always `dir="ltr" lang="en"`.
- Settings: theme (system/light/dark), language, font size (90–140 %), dyslexia-friendly font, key-click sounds (Web Audio, off by default), reduced motion (system + manual override).
- PWA: manifest + hand-written `sw.js` (precache app shell and routes, network-first for HTML, never caches Supabase requests) → installable and works offline as a guest.
- Content validator test: every sentence has ≥ 1 accepted answer, ar + en present, no duplicate ids or texts; every word has a valid category and level; scenarios have model answers.

## 8. Code style

```ts
// src/domain/typing/metrics.ts — pure, total, documented units
export interface KeystrokeLog { readonly t: number; readonly expected: string; readonly typed: string; readonly kind: 'correct' | 'error' | 'layout-mismatch' | 'correction'; }

/** Net WPM: correct characters / 5 per minute. `elapsedMs` must be > 0. */
export function netWpm(correctChars: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  return round1((correctChars / 5) / (elapsedMs / 60_000));
}
```
- Files kebab-case, components PascalCase, no default exports outside routes, no `any`, no non-null `!` in domain code.
- Domain functions are deterministic: time and randomness are injected (`now`, `rng`).
- UI text only through the i18n dictionary (type-checked keys for both languages).

## 9. Testing strategy
- **Vitest unit (test-first):** typing metrics, layout detector, key stats, adaptive selection, ghost, SM-2, normalizer, diff, grader and classifier (≥ 60 grader cases), checklist, levels, streak, diagnostic → plan, achievements, merge/LWW, outbox queue, nickname validation, plausibility mirror of the SQL rules.
- **Contract tests** for repository interfaces (local Dexie via an in-memory fake of IndexedDB *if approved*, otherwise against an in-memory implementation plus the Dexie adapter with narrow integration).
- **Content validator test** over all data files.
- **SQL:** `supabase/tests/rls_checklist.md` + `rls_tests.sql` (run manually in the SQL editor: impersonate two users, assert isolation and RPC rejections).
- Gates for every phase commit: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` all green.
- Lighthouse (mobile) on the landing page: target performance ≥ 90 and accessibility ≥ 95. Measured with local Chrome if possible; if not, it is reported as **not measured**.

## 10. Boundaries
- **Always:** keep domain pure and tested; use logical CSS properties; keep typing areas `dir="ltr"`; respect reduced motion; validate external input with zod; pin dependency versions; commit after each phase; record ambiguous choices in DECISIONS.md.
- **Ask first:** adding any package not on the approved list; installing extra skills or plugins; adding a remote or pushing.
- **Never:** use or mention a service_role key in app code; commit `.env*`, secrets or machine-specific paths; add analytics or tracking; make network calls other than fonts and Supabase; use AI APIs; animate the typing surface while the user types; build teacher/class mode.

## 11. Success criteria
- [ ] All P1–P5 features above meet their acceptance criteria.
- [ ] Guest mode works end-to-end with no Supabase env vars and no console errors, including offline after the first load.
- [ ] Content counts: ≥ 200 words, ≥ 150 sentences, ≥ 8 scenarios, all passing the validator.
- [ ] lint, typecheck, test and build all pass at every phase commit.
- [ ] Every Supabase table has RLS; public leaderboard views expose no email or user id.
- [ ] The client bundle contains no secret other than the public anon key (grep check).
- [ ] Usable at 360 px, 768 px and 1280 px in both themes and both directions; visible focus rings; keyboard-only navigation works.
- [ ] Lighthouse numbers reported as measured, or explicitly marked "not measured".

## 12. Roadmap (not built in V1)
- **Teacher / class mode:** a teacher creates a class, shares a join code, assigns lessons and sentence sets, and sees aggregate progress. Needs a role model, class tables with RLS by membership, and consent for minors. *Roadmap only.*
- Additional levels (B2+), more scenarios, a user-authored sentence bank, Arabic-English bidirectional exercises, and native mobile wrappers.

## 13. Out of scope (deferred)
- Social login (explicitly excluded).
- AI or LLM feedback (excluded: no AI APIs).
- Server-side anti-cheat beyond plausibility checks (not achievable with client-reported scores).
- Audio files and recorded voices (speech is Web Speech only).

## 14. Assumptions (correct me before approval)
1. **D1 i18n:** a small hand-written typed dictionary instead of next-intl. There is no locale-prefixed routing; the language preference is stored locally and applied to `<html lang/dir>` before first paint by a tiny inline script.
2. Next.js runs as a normal server app (not a static export), because `@supabase/ssr` auth callbacks need a route handler. Guest features are client-rendered with IndexedDB.
3. Levels A1–B1 only; the diagnostic places users in A1, A2 or B1.
4. Leaderboard thresholds: accuracy ≥ 90 %, test ≥ 30 s, WPM ≤ 250, rate limits as in §6.4. The weekly board resets on Monday 00:00 UTC.
5. Content is curated by hand (written for this project), not scraped.

## 15. Open questions
1. **Test-only dev dependency:** may I add `fake-indexeddb` (devDependency, tests only) to run the repository contract tests against the real Dexie implementation? If not, Dexie stays a thin adapter and the contract is tested with an in-memory implementation.
2. Lint: `create-next-app` ships ESLint. OK to keep it as the `npm run lint` tool?
