# Kitaba V1 — Task list

Each task: verify with `npm run typecheck && npm test` (domain) and `npm run build` at checkpoints.

## Phase 1 — Typing core
- [x] 1 Scaffold + tooling + git — Acceptance: dev server runs, vitest runs, strict TS
- [x] 2 Design system + i18n + shell — Acceptance: DESIGN.md, ar/en toggle, RTL, themes, settings persist
- [x] 3 Content schemas + typing data + validator test
- [x] 4 Typing engine/metrics/layout detector (tests first)
- [x] 5 Key stats/adaptive/ghost (tests first)
- [x] 6 Repositories (interfaces, Dexie, contract tests, export/import)
- [x] 7 Typing test UI + results + PB + ghost + layout hint
- [x] 8 Heatmap, adaptive drill, lessons, custom text
- [x] 9 Diagnostic → level + plan
- [x] 10 Stats page + landing page
- [x] 11 PWA
- [x] CHECKPOINT P1: all gates green, code review, commit

## Phase 2 — Spelling
- [x] 12 Word bank ≥ 200
- [x] 13 SM-2 + WordRepository
- [x] 14 Dictation + review UI
- [x] CHECKPOINT P2

## Phase 3 — Sentences and professional writing
- [ ] 15 Grader + classifier (≥ 60 tests)
- [ ] 16 150+ sentences + practice UI
- [ ] 17 Scenarios + checklist + UI
- [ ] 18 Achievements + certificate + share image
- [ ] CHECKPOINT P3

## Phase 4 — Accounts and sync
- [ ] 19 Migrations + RLS + RPCs
- [ ] 20 Supabase client + auth UI
- [ ] 21 Merge + outbox + sync + indicator + merge dialog
- [ ] 22 Privacy, export, delete
- [ ] CHECKPOINT P4 (+ security review)

## Phase 5 — Leaderboard
- [ ] 23 Leaderboard SQL + RLS tests
- [ ] 24 Nickname + plausibility + UI
- [ ] CHECKPOINT P5 (+ security + performance review)

## Finish
- [ ] 25 README, DECISIONS, Lighthouse attempt, final report
