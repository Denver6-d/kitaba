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
