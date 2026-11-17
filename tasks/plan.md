# Implementation Plan: Kitaba V1

Source spec: SPEC.md (approved). Tasks are tracked in `tasks/todo.md`. The user asked for phases 1–5 to run in one go, so the plan was not reviewed separately. Ambiguities are resolved in DECISIONS.md.

## Overview
A guest-first, offline-capable Next.js app that trains Arabic speakers in English typing, spelling, sentence writing and professional writing. It adds optional Supabase sync and an opt-in leaderboard.

## Dependency graph
```
content schemas (zod) ─┬─ data files ── content validator test
                       │
domain (pure) ─────────┼─ typing engine / layout detector / key stats / adaptive / ghost
                       ├─ srs, grader+classifier, checklist, levels/streak/achievements, diagnostic→plan
                       └─ sync merge + outbox, nickname + plausibility
repositories/types ────┬─ local (Dexie) ── contract tests (fake-indexeddb)
                       └─ supabase (P4) ── SQL migrations + RLS (P4/P5)
platform (tokens, i18n, theme, fonts, settings, PWA) ── features (React) ── routes
```

## Architecture decisions
- Domain is pure TS under `src/domain`, test-first. Time and randomness are injected.
- UI reaches persistence only through the `Repositories` context (`src/repositories/provider.tsx`).
- Typing input is captured on a hidden `<textarea dir="ltr">` with `onKeyDown` (for `event.code`) and `onBeforeInput`. During a test, rendering is restricted to the current word window (no layout thrash) and live metrics are throttled to 4 Hz.
- Landing-only motion libraries (gsap, lenis) are loaded with dynamic `import()` inside an effect, so typing routes never ship them.
- Hand-written i18n (D1). Language and theme are applied before paint by a tiny inline script.

## Task list (phase = commit)

### Phase 1 — Typing core
1. Scaffold: create-next-app, deps pinned, strict tsconfig, vitest, git init, .gitignore, .env.example
2. DESIGN.md (frontend-design) + tokens.css + fonts + theme + i18n + app shell (nav, settings)
3. Content schemas + typing word/phrase/sentence data + lessons + validator test
4. Domain typing engine + metrics + layout detector (TDD)
5. Domain key stats + adaptive + ghost (TDD)
6. Repositories: interfaces, Dexie impl, contract tests, export/import
7. Typing test UI + results + PB + ghost + layout hint + click sounds
8. Heatmap + adaptive drills + foundation lessons + custom text
9. Diagnostic → level and plan (domain TDD + UI)
10. Stats page (SVG chart, streak, goal, levels) + landing page (hero demo, GSAP/Lenis)
11. PWA manifest + sw.js
Checkpoint P1: lint/typecheck/test/build → code review → commit

### Phase 2 — Spelling
12. Word bank ≥ 200 with categories + validator
13. SM-2 (TDD) + WordRepository
14. Dictation UI (Web Speech + fallback) + "due today" review
Checkpoint P2 → review → commit

### Phase 3 — Sentences and professional writing
15. Normalizer, diff, grader, classifier (TDD, ≥ 60 cases)
16. 150+ sentences + validator; sentence practice UI with fading hints
17. Scenarios ≥ 8 + checklist (TDD) + UI
18. Achievements (TDD) + certificate (print CSS) + canvas share image
Checkpoint P3 → review → commit

### Phase 4 — Accounts and sync
19. SQL migrations + RLS + delete/export RPCs
20. Supabase client (configured/not-configured), auth UI (password, magic link, reset), callback route
21. Merge rules + outbox (TDD), Supabase repositories, sync engine + indicator, first-sign-in merge dialog
22. Privacy page, export, delete account
Checkpoint P4 → review + security review → commit

### Phase 5 — Leaderboard
23. Leaderboard SQL (tables, views, submit_score RPC, rate limit) + RLS tests/checklist
24. Nickname validation + plausibility mirror (TDD); opt-in UI, boards, leave
Checkpoint P5 → review + security review + performance review → commit

### Finish
25. README, DECISIONS, final checks (secret grep, Lighthouse via chrome-devtools MCP if available) → final commit

## Risks and mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Next 16 / Tailwind 4 / Supabase SSR APIs differ from memory | High | Fetch docs with Context7 before use |
| Typing latency under React re-renders | High | Engine in a ref; render only a small window; throttle metrics; memoized letters |
| RTL/LTR mixing bugs | Med | Typing surfaces `dir=ltr`; logical properties only; review both directions |
| Grader false positives | Med | Multiple accepted answers + heavy unit tests; label as heuristic |
| Leaderboard cheating | Med | RPC validation + rate limit; honest copy |
| Lighthouse not runnable here | Low | Report as not measured |
