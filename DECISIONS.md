# Decisions

Choices made while building Kitaba where the brief left room for interpretation. Newest phases are appended at the end.

## Tooling

- **T1. Context7 via CLI.** The Context7 MCP server is not configured in this environment. The Context7 skill's CLI (`npx ctx7`) works and was used to fetch current docs for Next.js, Dexie, shadcn, GSAP, Lenis and Supabase. Next.js 16 also ships its own docs in `node_modules/next/dist/docs`, which were read for Cache Components, `proxy`, the manifest and the PWA guide.
- **T2. chrome-devtools-mcp registered directly, not as a plugin.** The plugin manifest hard-codes the server arguments, so installing it as a plugin would leave Google usage statistics on. The same pinned package (`chrome-devtools-mcp@1.13.0`) is registered as a local-scope MCP server with:
  - `--no-usage-statistics` and `CHROME_DEVTOOLS_MCP_NO_USAGE_STATISTICS=1`;
  - `--no-performance-crux`, so trace URLs are never sent to the CrUX API;
  - `--isolated` and `--headless`;
  - `--file-navigations=false`;
  - `--allowed-url-pattern` set to `http://localhost:*/*` and `http://127.0.0.1:*/*` only.

  MCP servers load at session start, so during the build session the same package's CLI was used with the same flags to drive a headless browser on localhost.
- **T3. 21st MCP not used.** It is configured, but this session only exposes its authentication tools.
- **T4. `shadcn` is a devDependency.** The app only needs `shadcn/tailwind.css` at build time. `npm audit` reports a moderate ReDoS in `minimatch`, pulled in through the shadcn CLI's `ts-morph`. That is CLI tooling and never ships to the browser. shadcn's init also added `cn`, which is shadcn's own class merger from the `shadcn-ui/cn` repo.
- **T5. React Bits not used.** None of its components fit the restrained direction in DESIGN.md (most are showy text and background effects), so nothing was copied and there is no third-party licence to record.
- **T6. Next.js CLI telemetry.** `next build` prints a notice about anonymous CLI telemetry. That is build tooling and does not affect the app. To opt out on your machine, run `npx next telemetry disable` (or set `NEXT_TELEMETRY_DISABLED=1`). The app itself makes no analytics calls.

## Architecture

- **D1. Hand-written i18n instead of next-intl.** There are two languages and no locale routing is needed. The preference is stored locally and applied before first paint by a small inline script, which sets `lang`, `dir`, theme and text size. A typed dictionary means `en.ts` must have exactly the same shape as `ar.ts`, which the compiler enforces.
  - Trade-off: the server always renders Arabic text. An English user sees the right direction immediately but Arabic text for one frame until hydration. Fixing that would need a cookie read in the root layout, which would make every route dynamic under Cache Components.
- **D2. Repositories are written once over a storage-agnostic `RecordStore`.** `createRepositories(store)` implements ProgressRepository, WordRepository, SentenceRepository and the rest against a 5-method store interface. The backends are:
  - Dexie (local);
  - in-memory (tests, and private modes without IndexedDB);
  - Supabase (cloud, phase 4).

  The UI only sees the repository interfaces. One contract test suite runs against both the memory and the Dexie backends (via `fake-indexeddb`).
- **D3. Append-only records where possible.** These are append-only:
  - test results;
  - key-stat deltas (one per session);
  - sentence and scenario attempts;
  - activity events.

  Merging them is therefore a union and never double counts. Personal bests, streaks, XP and the daily goal are *derived* from those records, not stored.
- **D4. Persistence-shaped records.** Every synced record has `id`, `updatedAt` and an optional `deletedAt` tombstone (see `src/domain/model.ts`).
- **D5. The sentence grader was pulled forward into phase 1.** The phase-1 diagnostic needs to score three sentences, so `src/domain/sentences/*` landed with phase 1. The sentence bank and practice UI are still phase 3.
- **D6. Typing input uses a transparent full-size `<textarea>` and the `input` event.** Each input event is diffed against the previous value, so physical keyboards, mobile keyboards, autocorrect and IMEs all work the same way. The physical key (`event.code`) from the latest keydown is attached to single-character inserts for layout detection. Without a code (most mobile keyboards), the Arabic 101 layout map gives the intended key.
- **D7. Layout mismatches** (Arabic characters while English is expected) do not advance the caret, do not count as errors, and do not start the timer. Two in a row show the Arabic hint.
- **D8. Personal bests need at least 80% accuracy.** A fast run full of mistakes is not a record worth chasing. Untimed runs (lessons, drills, custom text) are stored with duration 0 so they never compete with timed bests.
- **D9. Performance on typing screens.**
  - The engine lives in a ref and the UI re-renders once per keystroke.
  - Each word is memoised on its typed slice.
  - The caret and line scrolling use `transform` set in a layout effect, with no transitions.
  - Live metrics refresh at 4 Hz.
  - GSAP and Lenis are dynamically imported on the landing page only.
- **D10. Random practice text is created only on the client.** Cache Components refuses `Math.random()` during prerender, so a per-page-load seed is read through `useSyncExternalStore` (0 on the server).
- **D11. Speech uses on-device voices only.** `speechSynthesis` voices with `localService === false` (for example Chrome's "Google US English") send the text to a third-party server. The brief allows no network calls besides fonts and Supabase, so those voices are skipped. If no local English voice exists, the learner sees a clear message and a fallback that shows the word for two seconds.
- **D12. Fonts.**
  - Latin families: Literata (display) and Hanken Grotesk (UI).
  - Arabic: Cairo.
  - Typing: Atkinson Hyperlegible Mono (it distinguishes l/I/1 and O/0).
  - Reading-friendly option: Lexend. It is described honestly as "reading-friendly", not as a dyslexia treatment, because OpenDyslexic is not available through `next/font`.
  - next/font's Latin metric fallbacks are Arial-based and contain Arabic glyphs, so the Arabic UI puts Cairo first and `:lang(ar)` elements always use Cairo.
- **D13. Practice text is curated full sentences.** Phrases feed the drills. The test pool goes up to one level above the learner's diagnostic level.
- **D14. CEFR placement** weights sentences 50%, spelling 35% and typing speed 15%, because the levels describe writing, not typing. The UI says it is a starting point, not a certificate.
- **D15. PWA.** The service worker is hand-written (`public/sw.js`):
  - Pages are network-first, falling back to the cache, then to `/offline`.
  - Hashed `/_next/static` assets are cache-first.
  - On install it precaches every page plus the `/_next/static` assets those pages reference, so guest mode is interactive offline after the first visit.
  - It never intercepts cross-origin requests (Supabase) or `/auth/*`.
  - It is registered in production builds only.

## Phase 2: spelling

- **S1. Only misspelled words get an SM-2 card.** The brief asks for spaced repetition of *misspelled* words. A new word answered correctly gets no card, though its Arabic hint still fades. A word that already has a card is reviewed with every answer. Answer quality:
  - 5: correct;
  - 3: correct after revealing the word;
  - 2: within two letters;
  - 1: wrong;
  - 0: empty.
- **S2. Classic SM-2.** The interval grows by the ease factor in effect *before* the review, and ease never drops below 1.3.
- **S3. American spelling throughout** (color, favorite, center, neighbor, license), so the bank, the sentence answers and the scenarios agree.
- **S4. Every spelling word comes with an example sentence** that is spoken on request. It disambiguates sound-alike words (their / there / they're), and the content test checks that each word appears in its own example.
- **S5. Daily-goal minutes for dictation** use a fixed 15 seconds per word. Per-word timing was not worth extra state.

## Phase 3: sentences, professional writing, rewards

- **G1. The sentence grader is a heuristic, not a grammar checker.** It is rule-based and deterministic:
  1. Normalise case, punctuation, curly apostrophes, contractions (`I'm` = `I am`, `can't` = `cannot`), digits up to twelve, and contractions typed without the apostrophe (`dont`).
  2. Run a weighted token-level Levenshtein alignment against every accepted answer and choose the cheapest.
  3. Classify each edit with ordered rules: article, to be, preposition, singular/plural, verb form or tense (stems plus an irregular-verb table), word order (moved or swapped words), spelling (character distance, with no tolerance for words of three letters or fewer), then missing, extra or different word.

  It cannot judge a correct sentence that is not in the accepted list. The UI says so on every sentence screen. Spelling and article mistakes count as half an error in the score. 60+ grader cases are unit-tested, and the content test checks that every accepted answer grades as correct.
- **G2. Far-off answers** (more than 4 errors and a score below 35%) get one plain message and the model answer instead of a long list of "different word" items. The details are one click away.
- **G3. Hints fade per sentence.** Mastery 0 offers a masked hint (`I a_ a s______.`), 1–2 offers the first word, 3 or more offers nothing.
- **P1. The professional checklist checks form only.** It looks for:
  - a greeting on the first line;
  - a closing phrase in the last three lines, followed by a name;
  - a polite phrase;
  - capitalised sentences (common abbreviations such as a.m. and Mr. do not end a sentence) and a capital I;
  - body lines that end with punctuation;
  - a length within the scenario's word range;
  - no text-speak;
  - each required point, matched by keyword at the start of a word.

  The content test checks that every model answer passes its own checklist.
- **R1. Achievements are derived** from stored progress by pure rules (`domain/progress/achievements.ts`). Correct dictations are counted from activity XP because activity records do not store the verdict. A new unlock shows a quiet toast, never confetti.
- **R2. Certificate and share image.** The certificate is a print-CSS A4 landscape page. The learner's name stays in the page and is not stored. The share image is drawn on a `<canvas>` with the same next/font faces (read from their CSS variables) and shared through the Web Share API, falling back to a download.

## Phase 4: accounts and sync

- **A1. Guest-first.** The app reads only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. If either is missing or malformed, `isSupabaseConfigured()` is false and no client is ever created. The account page shows "not configured" and everything else works locally. There is no service_role key anywhere. Account deletion uses a `SECURITY DEFINER` function that can only delete `auth.uid()`.
- **A2. Browser-only auth with PKCE.** `@supabase/ssr`'s `createBrowserClient` keeps the session in cookies. Email links land on a client page, `/auth/callback`, which completes the code exchange (`detectSessionInUrl`) and then follows a `next` path that must be same-site (`safeNext`, tested against open redirects). Magic links and reset links must be opened in the same browser that requested them; the UI says so.
  - Password reset answers the same way whether or not the address exists, so it can't be used to discover accounts.
  - A server-side `proxy` is not needed because no server code reads the session.
- **A3. One generic table.** Progress is stored as `public.progress_records(user_id, table_name, id, data jsonb, updated_at, deleted_at, server_updated_at)`.
  - Every record type is already validated by strict zod schemas on read (shared with file import), so a typed SQL schema per table would duplicate them.
  - RLS on the table allows select, insert, update and delete only where `user_id = auth.uid()`.
  - Rows are capped at 64 KB, and the table name is constrained to known values.
- **A4. Conflict rule: last-write-wins per record (D3, `domain/sync/merge.ts`).**
  - The server upsert RPC (`upsert_progress`) only overwrites when the incoming `updated_at` is at least the stored one, so a stale device cannot clobber newer data.
  - Ghosts keep the faster run and achievements keep the earliest unlock. When such a rule picks the older record, it is re-stamped `remote.updatedAt + 1` before upload, so the server's guard accepts it (`reconcilePulled`, tested).
  - Pulls use the server clock (`server_updated_at`) as a cursor, with a 5-second overlap so rows committed out of order are not missed. Re-merging a row is idempotent.
- **A5. First sign-in never overwrites silently (`decideFirstSync`, tested).**
  - If the device is already linked to the account, sync normally.
  - If the device has no progress, adopt the account's data.
  - Otherwise ask: **merge** (every local record is queued and merged with the rules above), or **keep separate**. "Keep separate" first downloads a JSON backup of the local data, then replaces it with the account's data.
  - Signing out keeps local progress on the device as guest data and unlinks it.
- **A6. Offline tolerance.**
  - Local writes are queued in a Dexie `outbox` table, de-duplicated per record (newest wins).
  - The queue is pushed in batches of 200 when online, on the `online` event, when the tab becomes visible, every 60 s, and shortly after each write.
  - Failures back off exponentially (1 s to 60 s).
  - A small header indicator shows synced, syncing, offline with pending count, or error.
  - The sync engine is tested against an in-memory server with the same last-write-wins semantics: two devices, conflicts, append-only union, ghost rule, offline queueing.
- **A7. Supabase verification is manual.** The Supabase `RecordStore` cannot be unit-tested without a network. It implements the same interface as the tested backends, and `supabase/tests/` has an RLS checklist and SQL assertions to run in the SQL editor.
- **A8. Phase 4 review fixes.**
  - Writes to `progress_records` go only through `upsert_progress()`, now `SECURITY DEFINER`. Clients have no direct insert or update grant, so the 500-row batch limit and the last-write-wins guard can't be bypassed. The function always writes `user_id = auth.uid()`.
  - RLS on the sync and leaderboard tables is enabled but **not forced**. Clients are never the table owner, so RLS always applies to them. Forcing it would make the owner-run writer functions depend on the owner role having `BYPASSRLS`.
  - Timestamps after the year 2100 are rejected, so one bad clock can't lock a record. Each user is capped at 50,000 records.
  - Switching accounts (A → B) always stops the old sync engine and waits for it before anything else happens. A running sync pass aborts before its next write. It also checks that the network session still belongs to its user.
  - Sign-out first tries to flush the queue (up to 5 s). By default it also removes the account's progress from the device, which suits shared devices; a checkbox keeps it. Deleting the account clears this device's copy too, and the copy says so.
  - "Keep separate" is now two steps: download the backup, then confirm the replacement. A blocked download can't lose the only copy.
  - Magic links never create accounts (`shouldCreateUser: false`). Sign-up is explicit.
  - Passwords are limited to 72 UTF-8 bytes (bcrypt's limit) rather than 72 characters.
  - `safeNext` also rejects control characters, which the URL parser strips (`/\t/evil.com` would become `//evil.com`). It then re-parses the path against a fixed origin.
  - Pulled records are compared with key-order-independent JSON, because jsonb reorders keys. Without this, every pull would look like a change.

## Phase 5: leaderboard

- **L1. Opt-in by choosing a nickname.** Nothing about a user is public until they join with a nickname. A `leaderboard_profiles` row *is* the opt-in. Leaving (`leave_leaderboard()`) deletes the nickname and every score at once, so the user is gone from both boards immediately. Rejoining starts from zero. Leaving asks for a confirmation click.
- **L2. Writes only through `SECURITY DEFINER` functions.** `submit_score()`, `set_leaderboard_nickname()` and `leave_leaderboard()` only ever touch `auth.uid()`. Clients have `select` on their own rows only, with no insert, update or delete grant. The public reads two views, `leaderboard_weekly` and `leaderboard_all_time`. They run as their owner and expose `rank, nickname, wpm, accuracy, achieved_at` only: no user id and no email. Each shows the best score per user, top 100. The weekly board starts on Monday 00:00 UTC.
- **L3. Plausibility checks (SQL is the authority, `domain/leaderboard/plausibility.ts` mirrors it).** A test checks that both use the same thresholds:
  - the user has opted in;
  - the test lasted at least 30 s;
  - accuracy is at least 90%;
  - WPM is at most 250;
  - the WPM follows from the characters and the duration, within max(2, 10%);
  - at most 1 score per 20 s and 60 per day.

  A per-user advisory lock serialises submissions, so parallel requests cannot slip past the rate limit. The UI says plainly that client-reported scores cannot be made fully cheat-proof.
- **L4. What competes.** Only the standard timed tests (words and sentences, 30 s or 60 s) are submitted. Custom text could be chosen to be easy, and drills, lessons and the diagnostic are not like-for-like; 15 s tests are below the minimum. The duration sent is the real elapsed time, because a timed test ends early when the text runs out. Nothing is sent for users who have not joined: the client checks the nickname first. The local save never waits for the network. The result line ("sent" or the reason it was refused) appears when the answer arrives, and network errors stay silent.
- **L5. Nicknames.**
  - 3–20 characters: Latin letters, digits, space, `_` and `-`, plus the Arabic letters ء–ي. Whitespace runs collapse to one space.
  - Unique regardless of letter case.
  - A basic blocked-word list (reserved names, common English and Arabic insults) is matched as substrings after normalisation: lower case, leetspeak (`0→o, 1→i, 3→e, 4→a, 5→s, 7→t, @→a, $→s, !→i`) and separators removed. It is deliberately basic and catches common words, not every insult.
  - The SQL seed and the TypeScript list are kept identical by a test.
  - Nicknames are rendered as text inside `<bdi>`, so a mixed-direction name cannot reorder the row.
- **L6. No offline queue for scores.** A score submitted while offline is simply not sent. Queueing scores would let a stale or replayed result arrive later and would complicate the rate limit, for little benefit.

## Finish

- **F1. Measurements (2026-11-17, production build, landing page, local headless Chrome).** These came from `chrome-devtools-mcp@1.13.0`'s CLI with the T2 privacy flags.
  - **Lighthouse, mobile and desktop:** Accessibility 100, Best Practices 100, SEO 100.
  - **Lighthouse Performance: not measured.** This tool's Lighthouse run leaves the performance category out. It also refuses network throttling while the localhost-only URL allowlist is on, and the allowlist was kept.
  - **Performance traces instead (no network throttling):**
    - desktop 1280 px: LCP 1.45 s, CLS 0.00;
    - mobile 412 px with 4× CPU slowdown: LCP 3.72 s, almost all of it render delay, CLS 0.00.
  - Measuring fixed two problems:
    - The landing story switched layout only after GSAP had loaded, which caused CLS 0.10. A CSS variant (`story-wide`) now picks the layout before first paint, and GSAP only cross-fades.
    - Two header controls had accessible names that didn't contain their visible text (WCAG 2.5.3).

## Pivot: spelling only (2026-11-17, approved by the owner)

- **V1. What changed and why.** The product now answers one question: "can the learner spell English words correctly?"
  - **Why:** the owner's review found that the four V1 skills (typing, spelling, sentences, professional writing) diluted the product. Spelling is the skill where Arabic speakers make the most predictable, rule-based mistakes, and where instant, explainable feedback works without a tutor or AI. The other three either need a grammar model (sentences, professional) or train a different skill (typing).
  - **Removed:** the typing speed test, Arabic-layout detector, key heatmap, finger and row lessons, adaptive drills, custom text, ghost race, the sentence grader and sentence practice, the professional-writing section, the diagnostic (it scored typing and sentences) and the certificate page (it certified typing and CEFR progress). Their routes, modules, data, i18n keys and tests are deleted, and the git history keeps them.
  - **Kept:** SM-2 spaced repetition, dictation with speech synthesis, stats, streaks, XP and levels, achievements (new spelling-based set), optional accounts and sync, the leaderboard (now a weekly spelling score), PWA, i18n, themes and the privacy pages.
- **V2. One product name constant.** `src/config/brand.ts` holds the name. The header showed "كتابة" and "Kitaba" side by side; it now shows one name, the same in both UI languages, so a rename is a single edit. The landing copy, metadata, manifest and share text all read the constant.
- **V3. Dexie v2 migration keeps what a learner still needs.**
  - Kept as is: SRS cards, achievements whose ids still exist, and the profile's daily goal.
  - Mastery: only `spell:*` keys are kept; typing and sentence mastery are dropped.
  - Activity: rows whose kind is gone (`typing`, `lesson`, `sentence`, `scenario`, `diagnostic`) become kind `legacy`, so streak days and XP survive.
  - Profile: `plan` and `diagnosticAt` are dropped. The level stays when it is still a valid level (A1–C1).
  - Dropped tables: `results`, `keystats`, `ghosts`, `attempts`, `scenarios`. Outbox entries for them are removed.
  - The same pure function (`migrateV1Tables`) runs inside the Dexie upgrade and when a v1 export file is imported, so old backups still load. It is unit-tested.
- **V4. Supabase migrations edited in place.** They were never applied anywhere, so the unreleased files were rewritten instead of adding a migration on top. `table_name` now allows the v2 tables. The leaderboard stores spelling sessions and shows a weekly total. `rls_tests.sql` and `rls_checklist.md` were updated to match.
- **V5. Levels A1–C1.** Content now spans five CEFR-style levels. They describe the word's difficulty and frequency, not a certified language level.
- **V6. American and British spelling.** S3 (American only) is replaced. Every word carries its American form, plus the British form when one exists. Settings choose the variant (default American), which sets both the voice (`en-US` or `en-GB`) and the expected spelling. The other variant is accepted with a note, except in the `british-american` category, where the requested variant is what is being tested. Voices stay on-device only (D11). When no on-device voice exists for the chosen accent, the other English accent is used and the UI says so.

### First-character bug (root cause)

- **B1. Symptom:** "the first character is often lost and has to be typed twice" in the typing and dictation inputs.
- **Root cause 1 (typing surface, removed with typing):** `useKeyCapture` kept a hidden textarea holding a sentinel space and diffed every `input` event against the last value. A pointer focus can place the caret *before* the sentinel (focus fires before the browser sets the caret from the click). The first character is then inserted at index 0, the diff sees a changed prefix, and a phantom backspace plus a reordered insert are dispatched. Separately, the effect that installs the listeners depends on `dispatch`. When a parent re-keys the run (the practice page keyed it on the profile level, which loads asynchronously and can arrive after the first keystroke), the whole run remounts and the first keystroke goes to the old engine.
- **Root cause 2 (dictation, still relevant):** `DictationCard` was keyed by word, so every new word unmounted the `<input>` and mounted a fresh one, which was focused in a `useEffect` after paint. During that gap focus sat on the "Next" button (or on `<body>` once the button unmounted), so a quick first keystroke went nowhere. On phones the virtual keyboard also closes and reopens between words, and the first tap is swallowed while it reattaches.
- **Fix:** one shared `SpellingInput` that stays mounted for the whole game session. A new item resets its value instead of replacing the element, so focus and the virtual keyboard never leave it. A keystroke never changes a React `key`. Timers start from the committed value (`onChange` handles the value and the start in one update), never from `keydown`. IME composition is respected: the value is always taken from the input, never reconstructed. The pure `answer-input` reducer models this. A regression test feeds the exact event sequence (first keystroke starts the timer, item change, composition) and checks that the first character is kept.

### Phase A notes

- **V7. One game engine, built in phase A.** The V1 dictation card held the first-character bug, so it was replaced right away by the shared game engine (`domain/games/engine.ts`) and `GameSession`, rather than patched and then replaced again. Phase C adds the campaign map, the daily challenge UI and polish on top of it.
- **V8. One game route with search params.** Stages, the daily challenge and free play all run on `/play/game?stage=…`, `?daily=1` or `?mode=…`, instead of 80+ dynamic pages. The service worker caches one page that works offline for every stage. The page reads the params inside a `Suspense` boundary, as Next 16 requires with Cache Components. Unknown params fall back to safe defaults (`parseGameRequest`, tested).
- **V9. Internal identifiers keep the old name.** The IndexedDB name, the export file's `app` field and the localStorage keys stay `kitaba`, so existing learners keep their data. Only what a person sees reads `PRODUCT_NAME`.
- **V10. Every example sentence is unique, and the short ones are the dictation pool.** A sentence of at most 12 words can be typed from one hearing. Boss stages dictate whole sentences from this pool. The content validator counts them, with a target of at least 800.
- **V11. The answer is shown again after a mistake.** The verdict shows the correct spelling, a letter diff of the learner's answer (missing letters inserted, extra letters struck, wrong letters beside the right ones), the category's one-line rule, the Arabic meaning and the example. When several alignments are equally short, extra or missing letters are placed as late as possible ("untill" reads as "until" plus an extra "l").

## Phase B: content

- **C1. 1,591 original words in 15 categories, A1–C1.** One file per category in `src/data/words/`. Every word has a short Arabic hint (no Latin letters, so it reads cleanly in RTL), a level and a unique example sentence that contains the exact word. All of it was written for this project; nothing was copied from word lists or books. Levels: A1 265, A2 352, B1 458, B2 283, C1 233. Every category has at least 94 words.
- **C2. Ids never change.** Ids are `w-<word>`. All 289 V1 ids are still present (`tests/fixtures/v1-word-ids.json`), so V1 review cards keep working. Some V1 words moved to a better-fitting category (the -ly adverbs to `adverbs-ly`); the id does not depend on the category.
- **C3. Homophones carry their confusables** (`their` ↔ `there`, `they're`). They are spoken with their example sentence and offered as distractors, with the sentence blanked, in Pick the Right Spelling.
- **C4. British spellings.** The 98 words in `british-american` all have a `uk` form, and so do American-spelled words elsewhere (color, center, favorite, favor, license, neighbor, traveled).
- **C5. Validation.** `npm run validate:content` (and the test suite) checks the schema, duplicate ids, spellings and examples, that each example contains its word, the V1 ids, homophone confusables, the volume thresholds, and that every campaign stage has enough words (a Spelling Bee pool needs at least 25).
- **C6. No repeats.** Sessions draw from a persisted shuffle-bag per pool. Spare words a mode could not turn into an item go back to the front of the bag, so a word repeats only after the whole pool has been played.

## Phase C: games

- **G-1. The map is the home of play.** `/play` shows today's card (streak, "continue where you left off", due reviews), the daily challenge, the 8 worlds with their 10 stage nodes (stars, a crown on the boss, locks with screen-reader labels), and free play with level and category filters that show how many words match.
- **G-2. Stars.** Untimed stages: 1 star at ≥ 60% (boss ≥ 70%), 2 at ≥ 80%, 3 at ≥ 95%. The Spelling Bee also needs 10, 15 or 20 correct words, so letting the clock run out after one right answer earns nothing. The next stage opens at 1 star; the next world when its boss has a star.
- **G-3. The daily challenge is the same for everyone at a level choice on a given day.** It is seeded by the date, and its best result is stored as stage `daily:YYYY-MM-DD`, which feeds the "seven daily challenges" achievement.
- **G-4. Arabic hints fade.** In listen-like modes the Arabic meaning shows until the word's mastery reaches 3 correct answers in a row (`hintLevel`), and it always shows after answering. Homophones always show it, because the meaning is what separates them. Missing Letters, Word Scramble and Pick the Right Spelling always show it, since it is part of the puzzle.
- **G-5. Celebration stays adult.** Stars draw in one by one, the points count up, a brass underline sweeps under "Correct", and a wrong answer gives a short shake. There is no confetti and no mascot, sounds are off by default, and all of it becomes instant under reduced motion.
- **G-6. Weekly leaderboard.** Every finished game (campaign, daily, free play, review) is offered to `submit_score` for a signed-in learner who joined the board. Nothing is sent for anyone else, and the client checks the same rules first.
- **G-7. Content review fixes (phase-end review).** A script had attached five British forms to the wrong rows (for example, "street" carried "licence"). They were moved to the right words, and the validator now rejects a `uk` form that is not a small edit of the American spelling. Words that did not fit their category moved (receptionist, until, cupboard, and the ie/ei words where i and e are separate syllables). Proper nouns (February, Wednesday) and the British -ed past tenses that British English also writes as -ed were removed, along with "ameba". Several Arabic hints and example sentences were made more natural.
- **G-8. Mixed Arabic and English labels start with Arabic.** "P وB" and "‎-ed و‎-ing" reordered badly in right-to-left text, so these labels now start with an Arabic word ("الحرفان P وB", "نهايات الأفعال ed وing") and use no leading hyphens.
- **G-9. Browser check (local headless Chrome, real key events through the DevTools protocol, no new dependency).** The first character was kept on the first word, when typing straight after Enter during feedback, after clicking Check, and after clicking Next. There were no console errors and no horizontal scroll at 390 px.

## Phase D: navigation, responsive, login, design

- **N1. Navigation.** The header holds the name, the four core areas (Home, Play, Review, My progress) from 768 px up, and a three-line menu button on every size. The menu is the existing Radix dialog (Sheet). It traps focus, closes on Esc and on an outside click, returns focus to the button, and opens from the end edge (left in Arabic, right in English). It holds Leaderboard, Account, Settings, Privacy, language and theme, and on phones the core areas too. Phones also get a bottom tab bar with the core areas. It hides on the game screen, which has its own bottom action, and while the keyboard is open. The footer shows only the name and one line. The header is opaque.
- **N2. Type and contrast.** Body text is 17 px on phones and 18 px from 768 px up. Secondary text is lighter (`#566B67` light, `#93A7A2` dark) and measured at 5.0:1 and 6.9:1 on paper (5.4:1 and 6.2:1 on raised sheets).
- **N3. Landing.** The hero is the copy beside a large, playable "Pick the right spelling" round (7 of 12 columns on wide screens). Below it come the seven modes, each with a miniature of its mechanic, then a worked rule example, the honest promise and a final call to action. GSAP reveals the round once and is skipped under reduced motion. Lenis was removed in phase A.
- **N4. Mixed scripts in Arabic.** An Arabic "و" directly before a Latin letter ("وb") reorders badly in right-to-left text, so it is always followed by a space ("p و b").
- **O1. Google and GitHub sign-in.** Both use `signInWithOAuth` (PKCE) with `redirectTo` built only from the page's own origin plus `/auth/callback` and a `next` path that passed `safeNext`, so there is no open redirect (`lib/auth-redirect.ts`, tested). Supabase must also allow-list that URL. Provider client IDs and secrets live only in the Supabase dashboard; the app reads only the URL and the anon key. A user who cancels on the provider's screen gets a calm message, not an error. Apple is not offered, because it needs a paid developer account. The first-login merge, sign-out and account deletion are the existing flows (A5, A8): an OAuth session goes through the same `onAuthStateChange` path as email.
- **O2. Verified in a real browser** (local headless Chrome over the DevTools protocol, production build). At 360, 390, 768, 1280 and 1920 px, in light and dark, in Arabic and English, on ten pages: no horizontal scroll and no console errors. Interactive targets are at least 44 px, except inline text links inside sentences, which WCAG exempts. Lighthouse was not run this time.

### Phase D review fixes

- **O3. Open redirect through dot segments (critical, fixed).** `/.//evil.com` passed the raw-string checks in `safeNext`, and the URL parser normalised it to `//evil.com`. The callback page would then have navigated a signed-in user off-site. `safeNext` now re-checks the normalised path. Both final reviewers found this independently, and it is covered by `tests/lib/safe-next-dots.test.ts`.
- **O4.** The OAuth buttons re-enable after the browser's Back button (bfcache) and after a thrown error. `access_denied` in either `error` or `error_code` counts as a cancel. The README now allow-lists `/auth/callback**` (the app adds `?next=`) and explains Google's Testing vs In-production publishing status.
- **N5.** The landing round keeps its first item stable through hydration, moves focus to Next after an answer and back to the first option after Next, and fades in with CSS from the first paint. GSAP was removed: it was only used for that reveal and flashed already-painted content. `motion` still drives the star celebration. The phone bottom bar stays visible under pinch-zoom (only an unzoomed viewport shrink means a keyboard).

## Phase E: learner levels and placement

- **E1. Level bug (root cause).** "Choosing B1 in the games menu changes nothing." There were two causes, both confirmed in the code:
  1. **Not stored.** The level picker on `/play` was `useState("all")` inside the free-play section. It reset every time `/play` mounted, so after one game the choice was gone.
  2. **Not read.** Only the free-play cards passed the level on in their URL. The big "Play" button and every stage node start campaign stages, whose word pool came from the world's fixed level list (stages 1–3 of world 1 are A1 only). The daily challenge read `profile.level`, which no screen ever wrote, so it was always null.

  So a learner who chose B1 and then pressed "Play" or opened the daily challenge always got beginner words.

  **Fix:** the levels now live in the profile, which is stored and synced. `buildSession` reads the profile on every build, so nothing is stale. Stages, bosses, the daily challenge and free play all use the stored levels.

  **Regression tests:**
  - choosing B1 changes the very next build of stage w1-s1 from A2 words to B1 words;
  - bosses follow the tests level;
  - every stage fills at every level;
  - a level change starts a fresh shuffle-bag.
- **E2. Three levels and what each drives (owner's choice).**
  - **Words:** free play and the nine normal stages of every world.
  - **Sentences:** the sentences and messages section (phase F).
  - **Tests:** the daily challenge and the boss stages.

  Campaign stages now use the learner's level instead of the world's fixed range (owner's choice). A world is a family of spelling problems, and the level picks the words. When a world has too few words at a level (for example ie/ei at A1), the pool widens to the nearest levels, easier first (`poolAtLevel`).

  - The daily challenge is the same for everyone at the same tests level on a given day.
  - The free-play level control is the words level itself, so there is one source of truth. The "all levels" option was removed.
  - The world cards no longer show a fixed level range, because it no longer applies.
- **E3. Storage and migration.**
  - **Profile v3:** `levels { words, sentences, tests }`, `levelSource` (choice, placement, skip, or null = never set) and `levelsAt`.
  - **Dexie v3:** no index change, only an upgrade that reshapes the profile and pending outbox writes.
  - **Export files:** now version 3. v1 and v2 files still import.
  - **One migration function:** the pure, idempotent `migrateProfileRow` does the v2 → v3 step everywhere. That includes cloud rows written by an older client, which `parseRow` migrates instead of dropping.
  - **Existing levels:** a v2 level (only the V1 diagnostic could set it) becomes all three levels with source "choice", so the learner is not asked again. No level means A2 with source null, so the welcome screen shows once.
  - **Supabase: no SQL change.** The profile is one jsonb row in `progress_records` and syncs with last-write-wins like before. A sync test shows the levels reaching a second device, with the later change winning.
- **E4. Placement test.**
  - **Format:** 16 "pick the right spelling" items. They need no audio, so they work without an on-device voice. At about 10 seconds each, the test takes about 3 minutes.
  - **Adaptive staircase:** it starts at A2 and moves up one level after a right answer and down one after a wrong one. The step halves at each change of direction, never below half a level.
  - **Result:** the highest level answered at ≥ 60% over at least two items, or A1 when no level qualifies. The one-line explanation gives the tally at that level and at the one above.
  - **Excluded words:** British/American pairs, because the right answer depends on the chosen variant.
  - **Tested:** simulated learners of every true level are placed exactly (unit tests).
  - The result is a starting point, not a certificate. Every level can be changed later.
- **E5. First visit.** `/play` redirects to `/welcome` while `levelSource` is null.
  - The landing page keeps its playable round, so "play within 10 seconds" still holds, and "Skip for now" sets A2 in one tap.
  - A signed-in learner is redirected only after the first sync (or when sync is offline or in error), so a new device does not ask for a level the account already has.

## Phase F: sentences and messages (spelling only)

- **F1. One spell-check dependency: `nspell@2.1.5` + `dictionary-en@4.0.0` (report to the owner).**
  - **What they are.** nspell is a Hunspell-compatible spell checker in plain JavaScript, by Titus Wormer. dictionary-en is the same author's packaging of the SCOWL en-US Hunspell dictionary (version 2020.12.07). The owner's brief named exactly this pair as one dependency.
  - **Licences.**
    - nspell: MIT. Its only dependency is `is-buffer@2.0.5`, also MIT.
    - dictionary-en: "(MIT AND BSD)". The SCOWL word list carries a BSD-style permissive licence, shipped with the files as `public/dict/LICENSE-dictionary-en.txt`.
    - Both allow commercial use and redistribution with the notice kept.
  - **Size.**
    - nspell is 42 KB unpacked, about 25 KB in the built worker chunk.
    - The dictionary is 552 KB (`.dic`) plus 3 KB (`.aff`) of plain text, which compresses well over HTTP.
  - **Maintenance.**
    - nspell's last release was 2.1.5 (2021, metadata updated 2022). It is stable rather than active: the Hunspell format it reads has not changed, and it is still widely used (it is the engine behind retext-spell).
    - dictionary-en 4.0.0 was released in November 2023.
    - `npm audit --omit=dev` reports 0 vulnerabilities.
  - **Alternatives rejected.**
    - `typo-js` (BSD-3-Clause) was republished one day before this phase (2026-11-16). That is too fresh to trust from a supply-chain point of view.
    - `hunspell-asm` is WASM and much larger.
  - **How it is loaded (browser only, lazily, nothing sent anywhere).**
    - `dictionary-en` reads its files with `node:fs`, so it cannot be bundled. `scripts/copy-dictionary.mjs` runs before `dev` and `build` and copies the files to `public/dict/`, which is git-ignored and generated.
    - The checker runs in a Web Worker (`features/writing/spell.worker.ts`). The worker is created only when a writing page opens, and it fetches the dictionary from this same site. The built output confirms that nspell is only in the worker's chunk, not in any page's main bundle. Building the dictionary in the worker (≈ 0.4 s in Node, longer on phones) never blocks typing.
    - No text leaves the device. The service worker caches the dictionary after its first use, so checking then works offline.
    - Side effect: Turbopack also copies the worker's TypeScript source into `/_next/static/media`. That is the same open source as the repository and is never loaded.
  - Exact versions are pinned (`--save-exact`), as for every other dependency.
- **F2. Spelling only, never grammar.**
  - The page states this on every writing screen ("Spelling only: an English dictionary on your device plus known rules for sound-alike words. It does not check grammar or style").
  - The confusable rules (F4) fire only on patterns that are wrong in almost every context. They are named "sound-alike word", not "grammar".
- **F3. The checker (`domain/writing/check.ts`, pure, dictionary injected).** Tokens keep inner apostrophes and hyphens.
  - **Skipped:** chunks with a digit, @, ://, or a leading "www."; all-capitals words (acronyms); the learner's own words; and a list of common Arabic names and Arab cities.
  - **Hyphenated words:** each part is checked.
  - **Capitalised unknown word inside a sentence:** treated as a name. Exception: a misspelled day, month or language within two letters (wensday → Wednesday) is flagged. nspell's own suggestions miss those, so they are matched directly.
  - **Capitalised unknown word at the start of a sentence:** flagged only when a real word is within two letters. A capitalised word that also appears mid-sentence is a name.
  - **Lower-case `i` and day names:** flagged as capital-letter mistakes.
  - **Contractions without an apostrophe:** `dont`, `im`, `theyre` and others are flagged, but only when they are not real words (`cant`, `wont` and `its` are left to the confusable rules or left alone).
  - **Suggestions are ranked:**
    1. a real word one typical learner slip away (ie/ei swapped, p/b or v/f swapped, a letter doubled or undoubled), so "recieve" becomes "receive" and not nspell's first choice "relieve";
    2. then word-bank words;
    3. then the closest by letters.
  - **British spellings:** the dictionary is en-US, so a British spelling is recognised by rules (our→or, ise→ize, tre→ter, ll→l before -ed/-ing/-er, ence→ense, ogue→og, plus listed pairs such as grey/gray and programme/program).
    - For an American learner it is accepted with a note and never counted as a mistake.
    - For a British learner it is silent, and an American spelling with a known British form gets the note instead.
  - **Tests:** every dictation sentence, message line, English prompt and help word must check clean with the real dictionary. This is the false-positive guard, and it caught two words the dictionary lacks ("onboarding", "wellbeing"), which were reworded.
- **F4. Confusable rules** (`domain/writing/confusables.ts`). A rule looks at the word and its direct neighbours in the same clause only.
  - **Fires on:** "your welcome / your going", "their is", "there house", "its a", "it's tail", "to hot", "me to.", "taller then", "to loose", "a big affect / affect on", "everyone accept", "please be quite", "were is…?" at the start, "we where", "could of".
  - **Left alone:** anything ambiguous, so correct uses stay quiet. Examples: "Are there books?", "open the folder then click", "your very own", "tell you where to go".
  - Both sides are covered by tests.
- **F5. Dictation comparison** (`domain/writing/dictation.ts`).
  - It is a word-level alignment. Case and punctuation are ignored; apostrophes count.
  - A typed word is paired with an expected word only when it looks like an attempt at it (letter distance ≤ max(2, half the length)). Otherwise it is one missing and one extra word, so the learner never sees "very → tired".
  - A British spelling of the expected word counts as right, with a note.
  - Accuracy is correct words / words in the text. Missing and extra words count as errors, but only misspellings go to the words to practise.
- **F6. Storage.**
  - **Two new synced tables:** `writings` (append-only history; text capped at 4,000 characters and 50 mistakes) and `dictionary` (id = the lower-cased word; removal is a tombstone, so it syncs).
  - **Local:** Dexie v4 adds both stores. The export format stays version 3, because the change is additive and phases E and F ship together.
  - **Supabase:** migration `20261118000001_writing.sql` widens the `table_name` check. It is a separate migration, so it applies on top of an existing database. RLS, the 64 KB row cap, the quota and the `SECURITY DEFINER` write path are unchanged, and `rls_tests.sql` and the checklist cover the new names.
  - The activity kind `writing` feeds streak days and XP.
- **F7. Mistakes go to review.**
  - Every misspelled word with a suggestion (capital-letter fixes and two-word fixes excepted) gets an SM-2 miss.
  - A word in the bank reuses its bank card (`w-…`, British forms included). Any other word gets `x-<word>`, which stores its spelling.
  - Every card stores the sentence it came from, with the word spelled right. For a dictation, that is the original sentence.
  - Review plays bank words as before, and `x-` words as listen-and-type with the stored sentence as the spoken example. The Arabic line reads "a word from your writing", because there is no dictionary meaning to show.
  - A new card is first due the next day (SM-2 S1), so "added to your review" means "in your deck", not "due now".
- **F8. Stars, XP and celebration.**
  - **Stars:** the game thresholds (60/80/95%), and only from three words up.
  - **XP:** one per correct word (capped at 60), plus 5 per star.
  - **Celebration:** the stage-clear stars and XP count-up are reused, with the optional "cleared" tone.
  - **History:** every check is saved. "Edit your text" and checking again saves a new entry, so the history shows progress on the same task.
- **F9. Navigation.**
  - "Sentences" joins the core destinations (the header from 768 px and a fifth bottom tab on phones).
  - The bottom bar hides on `/write/free` and `/write/dictation`, which have their own sticky action, as the game screen does.

## Phase G: reviews, checks and fixes (2026-11-18)

- **G1. Two independent reviews of phases E and F.** A code reviewer and a test engineer ran as separate agents. They were report-only, and both probed the checker with the real dictionary. Every confirmed finding below was fixed and has a regression test (`tests/domain/writing/review-fixes.test.ts`, plus updates in the existing suites).
  - **Confusable rules flagged correct English** (both reviewers found this). Examples: "Call me when you're home.", "They're friends.", "See you later then.", "I was younger then.", "We have to fast.", "from hot to cold", "not loose", "We all accept…", "all of you except Omar", "a quiet small town", "It's way too hot.", "should of course", "tell you where Ahmed lives", "Is there going to be…?".
    - The fixes narrow every rule to patterns that are wrong in practice:
      - "then" is flagged only when something follows it;
      - "to → too" never fires after "from" or an adjective;
      - "quiet → quite" only fires right after a form of "be";
      - "where → were" needs a following word from a short list;
      - names after "where" and nouns such as home, family and friends after "you're/they're" are left alone.
    - 22 correct sentences are now tested to stay quiet, and the clear errors are still caught.
  - **Names at the start of a sentence** (Majd → maid, Yazan → Kazan, Tabuk → taboo) were flagged, and every flag became a review card. The first word of a sentence is now flagged only for a typical learner slip (ie/ei, p/b, v/f, a doubled, missing or swapped letter) or a misspelled day or month. A capitalised word mid-sentence is checked only against days and months, which also saves the slow `suggest` call.
  - **"Add to my dictionary" did not undo the damage.** It now:
    - recomputes the score;
    - amends the saved history record (`writing.amend`);
    - removes the review card that check created (`words.forgetCard`, a tombstone, so the removal syncs).
  - **Checking unchanged text again earned XP again and added another SM-2 miss.** The same text is now shown with its earlier result and nothing is saved.
  - **Review notes.** The sentence lookup matched substrings ("wich" inside "sandwich") and capped the note *before* replacing the word, so a note could exceed the 400-character schema limit and make an export fail to import. Lookup and replacement now work on whole words, and the cap applies last.
  - **Privacy copy.** "Your text is never sent anywhere" was false for signed-in learners, whose saved texts sync. The page and the writing screens now say that checking never sends the text, and that saved texts sync to the learner's own account when signed in.
  - **SQL.** The new RLS test block had lost its `$$` dollar quotes (String.replace treats `$$` as `$`), so the script would stop there. Fixed.
  - **British learners were told to "correct" check, story and program** (cheque/storey/programme depend on the meaning). The reverse lookup of the British pairs was removed. Notes now come only from the word bank's British forms, minus meaning-dependent words (check, story, program, tire, draft, curb, practice, license, meter).
  - **British forms with endings.** "neighbour's" and "mum's" were counted as mistakes, and "mum's" was even "corrected" to "bum's". Possessive `'s` is now set aside before the name, personal-dictionary and British lookups. These irregular British words were also added: maths, learnt, spelt, dreamt, cosy, enrolment, fulfilment, woollen, paediatric, defence, offence.
  - **Tokenizer.**
    - Accented loanwords (café, naïve) were cut in two; they are now one token and are not flagged.
    - The "i" of "i.e." was flagged as a lower-case I; dotted abbreviations are now skipped.
    - "no." no longer counts as an abbreviation, so the next sentence start is recognised ("I said no. Becuase…" is now caught).
  - **Suggestions.** "recive" now gives "receive" (not revive or recipe), "teh" gives "the", and "wich" gives "which". Word-bank words one letter away are preferred, with a small bonus for vowel and double-letter slips, and letter swaps count as rule candidates.
  - **Dictation.** Extra words did not lower the accuracy; accuracy is now correct / (words + extra words), on screen and in the history. A hyphen and a space count the same ("well known" for "well-known"). The other spelling variant is accepted both ways.
  - **Profile.**
    - An empty or invalid `levels` object no longer counts as "chosen".
    - An invalid daily goal is repaired, so a migrated row always passes the export schema.
    - Merging two profiles no longer lets a newer row without levels (an older client, or a device that never chose) wipe chosen levels. Between two choices, the later `levelsAt` wins.
  - **Smaller fixes.**
    - "Another situation" is disabled while a check runs, and a late result never lands on the next task.
    - The live word count no longer announces every word to screen readers.
  - **Placement robustness.** A learner guessing among four options lands on A1 in at least 90% of 500 seeded runs (tested).
  - **Not changed.** For a placement test of 16 items, a learner who gets 50% right by chance can still reach a high level in a few percent of runs. That is acceptable for a starting point that can be changed at any time, and the UI says so.
- **G2. Browser checks (production build, local headless Chrome through the pinned `chrome-devtools-mcp@1.13.0` CLI with the T2 privacy flags).** The MCP server did not connect in this session, so its CLI was used.
  - **Responsive sweep.** 10 pages (`/`, `/welcome`, `/play`, a stage, `/write`, `/write/free`, `/write/dictation`, `/review`, `/progress`, `/settings`) at 360, 390, 768 and 1280 px, in light and dark, Arabic and English: 160 page loads.
    - **No horizontal scroll anywhere.** Each page was opened in a same-origin window of the exact width. Frames are refused on purpose by `X-Frame-Options: DENY`, which was kept.
    - **Touch targets.** The only target under 44 px was the 18 px settings switch, whose `::after` already extends the hit area to 46 px.
  - **Flows checked by script, with no console errors:**
    - first visit → `/welcome`;
    - placement test (16 items, then the result with its explanation and focus on the heading);
    - changing the words level to B1, after which the next stage shows the "B1" badge;
    - free writing (seven mistakes and two British notes found in 124 ms with the dictionary preloaded; after the review fixes, names and "later then" are not flagged, and adding a word rescored 89% → 94%);
    - message dictation with the word diff and the no-voice fallback.
- **G3. Lighthouse (navigation mode, mobile and desktop):** Accessibility 100, Best Practices 100 and SEO 100 on all nine pages audited (`/`, `/welcome`, `/play`, `/write`, `/write/free`, `/write/dictation`, `/review`, `/progress`, `/settings`). The first run found three problems, all fixed:
  - ink-soft text on the brass wash measured 4.46:1 on `/welcome` (the same pairing existed on `/play`'s daily card); both now use full ink;
  - a `<dl>` on `/progress` had a link as a direct child; the tile now uses a stretched link inside its `<dd>`;
  - the import file input on `/settings` had no label.

  Layout shift was also measured (not a requested category). The loading block now reserves the height of the content it is replaced by, so CLS dropped from 0.29 to 0.02 on `/play` (mobile), from 0.29 to 0.01 on `/progress`, and from 0.17 to under 0.01 on `/write/free`. The highest value left is 0.10 on `/review` (mobile). Lighthouse Performance itself was not measured, as in F1.

## Open data: a much larger library (2026-11-18)

The owner asked for a full dictionary, a large graded word set and tens of thousands of sentences, from sources whose licences allow this use. Every licence below was read in the source itself (not taken from a summary) before anything was downloaded for use.

- **OD1. Sources used.** `scripts/content/sources.json` is the machine-readable list. `tests/data/sources.test.ts` (part of `validate:content`) fails when a source lacks a licence, a link, its obligations or a pinned hash.

  | Source | Version | Licence (read in) | What we use | Obligations |
  |---|---|---|---|---|
  | SCOWL | 2020.12.07 (same as dictionary-en) | SCOWL notice, permissive, MIT-like (`Copyright` in the release and in ESDB v2), plus public-domain parts, the Ispell BSD licence and the WordNet 1.6 notice | size levels 10–60 as a commonness tier; the proper-name, abbreviation and taboo lists as filters | keep the notices in supporting documentation (credits page); sizes ≤ 60 only (UKACD terms start above 80); no Australian "D" spellings |
  | VarCon | 2020.12.07 | Kevin Atkinson and Benjamin Titze notices (permissive) plus the Ispell BSD-style licence (README, "Copyright") | American/British pairs (tags A and B only) | keep both notices and the Ispell licence in the documentation; mark the derived data as modified (Ispell clause 3) |
  | dictionary-en | 4.0.0 | MIT AND BSD (SCOWL), already approved in F1 | the full spell-check dictionary (layer 1, reused as is); validity filter; NOSUGGEST taboo flags | licence file kept with the copied dictionary |
  | Tatoeba | weekly export of 2026-11-14 (hashes in `sources.lock.json`) | CC BY 2.0 FR, part also CC0 (terms of use and downloads page) | English sentences, Arabic translations through eng↔ara links, English token counts for ranking, reviews and self-declared levels as quality signals | name each sentence's author and link to it, name and link the licence, say the sentences were filtered and normalised |
  | CMU Pronouncing Dictionary | commit 7479086 (2025-10-24) | BSD-2-Clause-style (CMU `LICENSE`) | homophones (same pronunciation, different spelling); silent-letter evidence. Pronunciations are not shipped | reproduce the CMU notice, conditions and disclaimer in the documentation (credits page) |

- **OD2. Sources rejected.**
  - **wordfreq:** its data is CC BY-SA 4.0 and mixes several sources with their own terms (SUBTLEX credit, Twitter's developer agreement). Its author says exporting the data to a plain list is not acceptable.
  - **Wiktionary translations and Arabic WordNet (AWN v2, CC BY-SA 3.0):** share-alike would apply to the hint data. The owner chose our own hints only (OD4).
  - **Oxford 3000/5000, Cambridge, Merriam-Webster, Collins:** copyrighted.
  - **SUBTLEX-US, Google Web 1T and Norvig's counts:** terms unclear or LDC-licensed.
  - **ESDB (SCOWL v2, 2026):** its licence is fine (read and recorded), but building it needs Python and SQLite, which this machine does not have. SCOWL v1 2020.12.07 is the exact version dictionary-en was built from, so the spell checker and the word filters agree.
  - **Google Books Ngram (CC BY 3.0):** allowed, but multi-gigabyte and skewed toward old printed text. Tatoeba's own token counts are conversational and enough to rank the top 20,000 words.

- **OD3. The pipeline** (`scripts/content/`, dev-only, no new npm dependency).
  - `npm run content:build` runs the steps in order. `--from=<step>` and `--only=<step>` select steps, `--force` ignores checkpoints, and `--update` accepts a new upstream snapshot.
  - Downloads go to `content-raw/downloads/<source>/` and extracted files to `content-raw/extracted/<source>/`. Both are git-ignored.
  - Archives are opened with the system's `tar` and `bzip2`. Arguments are passed as an array, with no shell. Archives are data only: the Perl and Python files inside SCOWL and VarCon are never run.
  - **Repeatable:** `sources.lock.json` (committed) pins the SHA-256 and size of every file. A different file is refused unless `--update` is passed. Tatoeba keeps no old exports, so accepting a new weekly snapshot is a deliberate, recorded step.
  - **Resumable:** downloads are written to `.part` files and renamed when complete. Every step stores a checkpoint keyed by the hash of its script, options and inputs, and is skipped while that key and its outputs are unchanged.
  - Only the cleaned, compact output in `public/content/v1/` and the reviewed source files under `scripts/content/` are committed.
- **OD4. Owner decisions (2026-11-18).**
  - **Arabic hints:** our own hints only. These are the 1,591 existing hints plus new hints for the most frequent words, written and reviewed in batches. Other words have no hint, and every game works without one.
  - **Tatoeba credit:** each Tatoeba sentence shows a small "Tatoeba #id · author" line linked to the sentence. An "Open data credits" page carries the licences, the notices and a downloadable list of every sentence and its author.

### Open data, phase B: words and levels (2026-11-20)

- **OD5. The word library.** These are pipeline steps 02–04 and 09 (`npm run content:build`):
  - **Lexicon (step 02).** The candidates are SCOWL `english-words` and `american-words` at sizes 10–60, each tagged with its smallest size. A candidate is kept when it:
    - is lower-case letters with optional inner hyphens, at least two letters long;
    - is accepted by dictionary-en through nspell (the same dictionary as the browser);
    - is not a SCOWL abbreviation;
    - is not taboo: SCOWL `misc/offensive.*` and `misc/profane.*`, plus dictionary-en's NOSUGGEST words;
    - is not on our reviewed `scripts/content/blocklist.json` (see below).

    Of 101,368 candidates, 76,558 are kept. Every rejection is counted by reason in `content-raw/work/lexicon.json`. Possessives make up 24,108 of the rejections; sensitive, taboo and abbreviation rejections total 444.
  - **Frequency (step 03).** Token counts come from the 2,041,097 sentences of the pinned Tatoeba English export. Only counts are derived; no text is kept. A capitalised token at the start of a sentence counts for the lower-case word only when that word is mostly lower case mid-sentence, so "Tom" does not count for "tom". 32,863 lexicon words occur at least three times.
  - **Selection and levels (step 04).** The 20,000 most frequent words are taken, counting the hand-written bank, so the rank is a true rank. Words under three letters are dropped. Levels come from rank bands (A1 ≤ 600, A2 ≤ 2,000, B1 ≤ 4,500, B2 ≤ 8,000, C1 above), and a word SCOWL only lists at size 50 or more is never easier than B2. Against the bank's hand-set levels, 1,374 of 1,531 ranked bank words fall within one level, and 675 match exactly. The levels describe frequency, not a certified level (V5).
  - **The bank stays as is.** The 1,591 hand-written words keep their ids, levels, categories, hints and examples, and stay bundled. The library holds only words that are not in the bank (18,466 words), so no id can change or clash (tested).
  - **Categories (`lib/classify.mjs`, pure, tested).** The first matching rule wins:
    1. British form (VarCon);
    2. homophone (CMUdict);
    3. plural with a spelling change;
    4. verb ending with a spelling change;
    5. -ly adverb;
    6. prefix;
    7. ie/ei (not when i and e are separate syllables, and not -ies/-ied);
    8. silent letter, confirmed by CMUdict where it has the word;
    9. plain -ed/-ing;
    10. double consonant;
    11. suffix;
    12. dropped short vowel (speech drops a written vowel, or three or more single-letter vowel sounds);
    13. consonant cluster (in `common`, like the bank's street/spring);
    14. p, then v;
    15. weak vowel;
    16. `common`.

    The classifier agrees with the bank's hand-set category for 979 of 1,591 words (62%). The categories overlap by nature ("unnecessary" is both a prefix word and a double-letter word), so agreement is reported, not forced.
  - **British forms.** VarCon A/B pairs are used only when all of these hold:
    - the British form is a small edit of the American one;
    - the word is not meaning-dependent (the G1 list, including inflections such as practicing);
    - the British form is not an American word in its own right;
    - the pair is not a -t past tense (learnt, spilt), which British English does not require (G-7).
  - **Homophones.** Only primary CMUdict pronunciations are used, and both words must be in the top 10,000 or in the bank, so "the" is not paired with "thee". A homophone is spoken with its example sentence, so until it has one (phase C) it is published under its next category.
- **OD6. Sensitive-content blocklist (`scripts/content/blocklist.json`, written and reviewed for this project).**
  - **Two tiers.** The `words` tier removes words from the library and from sentences: sexual terms, drugs, alcohol, pork, gambling, slurs and insults, self-harm. The `sentences` tier only removes sentences: violence and death, religion, politics, romance and the body, smoking.
  - **Moved to the sentence tier.** Everyday words that are only sometimes sensitive (sake, dealer, weed, affair, breast, jerk) stay playable as words.
  - **Inflections.** Each entry also blocks its simple inflections.
- **OD7. Published format (step 09).**
  - **Files.** `public/content/v1/words-<LEVEL>.<hash>.json` holds rows `[word, rank, extra?]` grouped by category; `extra` holds `uk`, homophone confusables `c`, and (later phases) `ar` and `ex`. Each file is named by its SHA-256 prefix, so a URL never changes content and can be cached forever. `manifest.json` (stable name) lists each file's hash and size, and stale files are deleted.
  - **Sizes.** Raw: A1 6 KB, A2 15 KB, B1 35 KB, B2 56 KB, C1 220 KB. Gzipped, the five total 130 KB.
  - **Validation.** `src/data/library-schema.ts` (zod) validates every chunk in `validate:content` and, from phase E, at runtime. The tests check the hashes, that no word or id is a bank word, that there are at least 8,000 words over every level and category, and that every campaign stage fills at its world's levels.
  - **Counts.** These are recorded here and in the git-ignored reports only. The site never shows them.
- **OD8. Fixed on the way.** The sentence-dictation length check split on the letter "s" (`/s+/`) instead of whitespace. Long sentences with few s's were dictated in boss stages, and short ones full of s's were not. It now splits on whitespace, with a regression test.

### Open data, phase C: sentences (2026-11-20)

- **OD9. Sentences from Tatoeba (step 05).** These come from the 2,041,097 English sentences of the pinned export. The filters run in this order, and every rejection is counted in `content-raw/work/report-sentences.json`:
  1. **Form.** Printable ASCII after straightening typographic apostrophes and spaces, a capital start, one final `.`, `?` or `!`, and only letters, spaces, commas, apostrophes and inner hyphens. There are no digits (prices, times, phone numbers), no quotes, brackets, e-mails or URLs, and no "Mr./Dr." abbreviations. Each sentence has 3–16 words. Rejected: 92,342 for form, 6,345 for characters, 47,761 for length.
  2. **Quality.** No −1 review, a known author (39,815 orphans dropped), and either a native English author (`user_languages` level 5) or a +1 review (390,627 dropped).
  3. **Names and personal data.** A capitalised word must be on the reviewed allowlist `scripts/content/names.json`:
     - Tatoeba's stock names, days, months, languages, and non-contentious countries and cities;
     - a possessive name counts too.

     Real people, brands and news places therefore drop out (46,386). Tatoeba's recurring story names (Sami, Layla, Fadil and others) are left out on purpose, because their series are mostly about crime and abuse.
  4. **Sensitive content.** Both tiers of the blocklist apply (78,736 in total). The sentence tier gained a few stems after a sample review: armed, gore, deity, idol, prophet, temple and others.
  5. **Graded vocabulary.** Every word must be in the bank or the library, a short function word, or a contraction, so the sentence can be given a level (228,554 dropped).
  6. **The app's own checker** (`src/domain/writing/check.ts` with the real dictionary) must flag nothing. The pipeline imports it through Node's type stripping and a small resolve hook (`lib/ts-hooks.mjs`, dev only). This removed 259 sentences, for example "approve of your going", where the sound-alike rule would fire. A learner is never "corrected" on a library sentence.
  7. **Duplicates.** Exact duplicates (case and punctuation ignored) and near duplicates (the same words in any order, story names collapsed) are removed: 2,659 and 31,261.

  **Result:** 1,073,965 clean sentences. A sentence's level is its hardest word's level, raised by length (A1 ≤ 6 words, A2 ≤ 8, B1 ≤ 10, B2 ≤ 12, C1 ≤ 16).
- **OD10. What is published.**
  - **Dictation pools.** Up to 8,000 sentences per level. Every example sentence is included first; the rest are chosen by a +1 review, then by having an Arabic translation, then by a stable shuffle of the id, so that no single contributor dominates. In total there are 42,924 sentences (C1 has 10,924, because all of its examples are kept). 11,783 of them carry an Arabic translation through `eng-ara_links` (only translations with no −1 review and no Latin letters), credited to their own author.
  - **Examples.** 17,441 of the 18,466 library words have an example: the shortest good sentence of 4–12 words with the word, preferring the word's own level and a +1 review, and never shared between two words. Homophones keep their category only with an example; the rest play under their next category.
  - **Original fill-ins.** Of the 3,000 most frequent library words, 73 had no example: their Tatoeba sentences were all removed by the sentence blocklist (died, smoke, crime…). We wrote 20 original, neutral examples (`scripts/content/original/examples.json`), which must contain the word and pass the app's checker. The remaining 53 occur only in sensitive senses (war, kiss, church, prison…). They keep no example and play in the modes that need none.
  - **Files.**
    - `sentences-<LEVEL>-<n>.<hash>.json` (`{ level, authors, rows: [id, text, author#, [araId, arabic, author#]?] }`): 14 files, 2.7 MB raw, 1.06 MB gzipped.
    - Word chunks now carry their examples (`examples[id] = [text, author# or −1]`), so building an item needs no second request. They are split at 240 KB into 10 files, 1.6 MB raw, 0.64 MB gzipped.
    - `tatoeba-credits.<hash>.tsv` (id, language, author, with the licence, the change note and the URL pattern in its header): 0.9 MB raw, 0.26 MB gzipped.
  - **Attribution (CC BY 2.0 FR).** Every Tatoeba sentence and translation is in the credits file with its author, and every chunk row carries its author for the small credit line (phase E). The test suite checks both. A few sentences are also CC0; crediting those too is harmless.
  - **Known limit.** Tatoeba sentences are checked for spelling, not grammar. A native author's slip ("How would you feel is someone did that…") can pass. This is rare, and the report and the app never claim more than spelling.

### Open data, phase D: Arabic hints (2026-11-20)

- **OD11. Hints for the 3,000 most frequent words.**
  - **Coverage.** The frequency rank counts the bank, so 808 of the top 3,000 are bank words that already have their hand-written hint. The other 2,192 got new hints, written for this project in ten rank-ordered batches (`scripts/content/hints/batch-01.json` … `batch-10.json`).
  - **Review.** Each batch was validated by step 06 and reviewed before the next was written.
  - **How they are written.**
    - Hints follow the bank's style: a short meaning, with `/` between senses ("يحصل على / يصبح").
    - Inflected forms get the meaning of the form ("wanted" → "أراد / مطلوب", "gone" → "ذهب / رحل (التصريف الثالث)").
    - Function words get a plain gloss ("the" → "أداة التعريف (الـ)").
    - Hints follow the word's everyday sense; where a word also has a sensitive sense, the hint gives both plainly ("drugs" → "أدوية / مخدّرات").
  - **Validator (`06-hints.mjs`, and the content tests).** Each hint must:
    - contain Arabic letters and no Latin letters;
    - be at most 60 characters;
    - have no stray spaces and no empty alternative;
    - belong to a library word, and appear in one batch only.

    The step fails on any problem, and the test requires a hint for every top-3,000 library word.
  - **Elsewhere.** Words below the top 3,000 have no hint (OD4). Every game already works without one: the hint line simply does not show.
  - **Licence.** The hints are our own (no Wiktionary or AWN, OD2), so no share-alike applies.
- **OD12. More words removed from the library before writing hints.**
  - `ass` (vulgar), informal spellings that are not standard written English (gonna, wanna, gotta, yeah…), and archaic forms (thou, thee, thy, ye, whilst).
  - They are a new `informal_and_archaic` group in the blocklist's `words` tier, which also removes sentences that use them.
  - The library stays at 18,466 words, because the next-ranked words take their place.

### Open data, phase E: loading, offline, credits, performance (2026-11-20)

- **OD13. The library loads on demand.**
  - **Loader (`src/features/library/library.ts`).**
    - The manifest is network-first (falling back to its cached copy), so a deploy with new content is seen at once.
    - Data files are cache-first, because their names carry a content hash.
    - Everything lives in one Cache Storage cache, `kitaba-content-v1`, shared with the service worker. The service worker keeps it across deploys, because hashed files never go stale.
    - Every file is validated with zod (external input) and memoised in memory. A failed load is not remembered, so the next game retries.
    - Any failure resolves to "no library words" and never to an error, so a game always starts from the bundled bank.
    - **Why Cache Storage rather than an IndexedDB table (as planned).** The service worker can only serve Cache Storage. A second copy in IndexedDB would double the storage and need a Dexie schema bump in the synced database for data that is not the learner's. Parsed words are memoised in memory instead.
  - **Games.**
    - `buildSession` loads only the learner's level: the bank (all levels, so a short world still widens) plus the library words at that level.
    - Every session now returns the map of words it uses, so the game screen and the results never look words up in the bank alone.
    - Review finds library words by id, loading the level nearest the learner's words level first.
    - Distractors avoid every loaded spelling, not just the bank's.
    - A homophone without an example is never spoken alone, and modes that need an example (fix the mistake, sentence dictation) skip words that have none.
    - The daily challenge draws from the bundled bank only, so it is the same for everyone at a level on a day whether or not the library loaded (OD15).
  - **Dictation.** Sentence dictation draws from our own sentences plus the library sentences at the learner's level. After checking, it shows the sentence's credit and, when Tatoeba links one, its Arabic translation with that author's credit.
  - **Mistakes from library sentences.** A misspelled word in a library sentence becomes an `x-` review card (with the sentence), as for free writing. Mapping it to a library id would need a synchronous lookup the checker does not have.
  - **Attribution.** "Tatoeba #id · author", linked to the sentence, plus "CC BY 2.0 FR" linked to `/credits`. It appears wherever a Tatoeba sentence is shown:
    - after an answer that used an example (fix the mistake, a homophone's sentence, the verdict line);
    - after a boss sentence;
    - in dictation, when the text is shown or revealed.
  - **`/credits`** (menu and privacy page).
    - It lists each source with its licence and what we took from it, and offers the Tatoeba list (id, language, author) as a download.
    - It reproduces word for word the SCOWL, VarCon (with Ispell), dictionary-en and CMU notices. Step 07 (`07-notices.mjs`) generates them into `src/data/credits/notices.generated.ts`, which only `/credits` imports (checked by `check:bundle`).
    - Lighthouse (mobile): 100 / 100 / 100.
  - **Settings, "The full library offline".** It downloads every file into the content cache and shows progress as a percentage and the size in MB (5.4 MB stored; transfer is gzipped). It can also remove the copy. Lighthouse (mobile): 100 / 100 / 100.
  - **No counts on the site.** The landing page's "N words" fact and the free-play "N words match" line are gone. With the library, every level and category has words, so the "no words" state of free play is gone too. A test checks the copy for content totals and the source for rendered list sizes.
- **OD14. Performance and the bundle budget.**
  - **Lazy Supabase.** `@supabase/ssr` was imported on every page, about 66 KB gzipped, even when accounts are not configured. It now loads with a dynamic `import()` only when accounts are configured. Until it loads, `ready` stays false, which every account screen already waits for. If the import fails, the learner stays a guest.
  - **First-load JavaScript (gzipped, all scripts in the page's HTML).** "Before" was measured during this phase, with the library already wired in but Supabase not yet lazy; "after" is the final build:

    | Page | Before lazy Supabase | After |
    |---|---|---|
    | `/` | 413 KB | 346 KB |
    | `/play` | 421 KB | 354 KB |
    | `/play/game` | 473 KB | 406 KB |
    | `/write/free` | 488 KB | 422 KB |
    | `/offline` | 367 KB | 300 KB |

    CSS is 14 KB on every page.
  - **What is left.** It is the framework: React and Next (about 116 KB), both i18n dictionaries plus zod (53 KB), Dexie (37 KB), Radix and the bundled bank (13–38 KB). The library itself adds no first-load bytes: it is fetched only by the pages that play.
  - **Measured on localhost** (production build, no throttling): LCP 209 ms and CLS 0 on `/`.
  - **`npm run check:bundle`** (`scripts/bundle-report.mjs`, run after the build) prints these numbers. It fails when:
    - a page's first-load JS is over 440 KB gzipped (today's heaviest page plus 4%);
    - first-load JS contains nspell, library chunk data, or the licence notices outside `/credits`.
- **OD15. Phase E review fixes.** A code reviewer and a test engineer ran as separate, report-only agents, and both probed the loader with real files. Every confirmed finding was fixed, and the new tests are in `tests/features/library.test.ts`, `dictation-pool.test.ts` and `build-session.test.ts`.
  - **A failed load was remembered until the page reloaded (both reviewers).** `wordsAt`/`sentencesAt` stored a successful `[]` when the manifest could not be read. They now treat that as a failure, so the level loads once the network is back.
  - **Games could wait forever on a stalled connection.** Library loads in games, review, dictation and `/progress` now give up after 4 s (`withTimeout`) and use the bank. The load goes on in the background and is kept when it succeeds.
  - **The daily challenge differed with and without the library.** It now uses the bank only.
  - **Review dropped due library cards when the library was unreachable.** The word is rebuilt from its id (`w-exhale` → "exhale", no hint, no example). This happens only when the library cannot be reached: a word the reachable library no longer has was removed, and its card is skipped as before.
  - **`/progress` downloaded the whole word library for writing-word ids (`x-…`), which can never be in it.** Those ids are now left out.
  - **A failed Supabase load left a blank account page and a "not configured" leaderboard.** The account and leaderboard pages now show loading while it loads, and an error with "Try again" if it fails. It is also retried when the browser comes back online. The leaderboard no longer says "not configured" while loading.
  - **Settings said "this browser cannot store the library" when it was only offline.** The status now tells "no storage" apart from "unreachable", and the latter has a retry. Keyboard focus moves to the live status during a download.
  - **Long-lived tabs.** A tab open across a content deploy asked for files that no longer exist. A failed file now makes the loader read the manifest again, once.
  - **Old files.** Hashed files from older content versions piled up in the content cache. They are pruned whenever a new manifest is read.
  - **Download.** The offline download no longer includes the credits list (about 0.9 MB), which games never need. The abort signal now reaches `fetch`.
  - **Dictation.**
    - It no longer shows the previous text while library sentences load.
    - The pool is a pure, tested helper.
    - Library sentences far outnumber ours at each level, so the hand-written sentences come up less often. That is accepted: the library is the point.
  - **`check:bundle`.** A script it cannot find now fails the check instead of counting as 0 bytes.
  - **Not changed.**
    - A Tatoeba example shown in "fix the mistake" is credited in the feedback right after the answer, not inside the puzzle, so the misspelled word cannot be found by following the link.
    - External links open in a new tab without a spoken hint. This matches the existing privacy and credits links.

## First-visit level screen (2026-11-20)

- **L1. One central first-visit redirect (supersedes E5).** A visitor with no stored level (`levelSource` null) is sent to `/welcome` on the first page they open, whatever it is, and then returned to it.
  - **Which pages.** Every page is gated except `/welcome`, `/privacy`, `/credits`, `/offline`, `/auth/*` and `/account` (with `/account/reset`). The sign-in page counts as an auth route, so a returning learner on a new device can sign in before being asked. API, framework, content, dictionary, service-worker and other static requests are never gated (`shouldGate`, `lib/first-visit.ts`).
  - **No flash.** The inline pre-paint script marks a gated page `data-gate="pending"` before first paint whenever this browser has never stored levels (a localStorage marker). CSS then hides `<main>`, showing only a quiet brass rule.
    - On client-side navigation, `FirstVisitGate` sets the same mark in a layout effect.
    - The gate (in the providers) reads the profile and either removes the mark or replaces the URL with `/welcome?next=…`.
    - In a headless-browser check, a fresh visit to `/play/game?stage=w3-s2` showed 27 frames, all with the page hidden, before `/welcome`. A click on "Play" from `/privacy` never painted `/play`.
  - **Return.** `next` is the path and query that were asked for. On the way back it is read with `returnPath`, which goes through `safeNext` (same-origin relative paths only, with the dot-segment and control-character guards of O3) and refuses `/welcome` itself, so there is no loop. Choosing, finishing the test and skipping all return to it (default `/play`).
  - **Signed-in learners.** As before (E5), a learner whose account may hold levels waits for the first sync, or until sync reports offline or an error, before being asked. Levels that arrive from the cloud mean they are not asked.
  - **When the page is simply shown.**
    - IndexedDB is unavailable (the in-memory fallback, so nothing would be kept) or the profile cannot be read.
    - The wait passes 8 seconds.
    - Storage throws in the pre-paint script, which then marks nothing.
  - **Later data changes.** A page is decided once. A later data change (a sync pull, "delete my data") never pulls the learner away from the page they are on; the next navigation is checked again.
  - **The landing page is gated too, as asked.** It used to be exempt, so that the hero round was playable within 10 seconds (E5). Now "Skip for now" is one tap away, and it returns to `/`.
  - **Welcome screen.** "Test my level" is now the primary action: first, a filled button at the largest size, with its description under it. "I choose my level" (outline) and "Skip for now" (text) sit below as secondary actions. Lighthouse (mobile) on `/welcome`: 100 / 100 / 100.
  - **Tests (`tests/lib/first-visit.test.ts`):**
    - which paths are gated;
    - `next` round trips, open-redirect inputs and loop inputs;
    - the decision table: no level, levels, loading, timeout, blocked storage, signed-in sync;
    - the pre-paint script itself, run in a VM, including blocked storage;
    - the welcome buttons' order and variants.
