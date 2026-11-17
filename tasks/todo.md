# V2 task list

## Phase A: docs, scope cut, bug fix
- [x] SPEC.md rewritten (pivot), DECISIONS.md pivot section, DESIGN.md V2
- [x] Removed typing, layout detector, heatmap, lessons, drills, custom text, sentences, professional writing, diagnostic, certificate (code, routes, data, i18n, tests)
- [x] Dexie v2 migration + v1 export import (shared pure migration, tested on fake-indexeddb)
- [x] Supabase SQL: v2 table names, weekly spelling leaderboard, RLS tests and checklist
- [x] Product name constant; single-name logo
- [x] First-character bug: root cause recorded (B1), persistent SpellingInput, regression tests
- [x] Game engine, item builders, misspelling generator, shuffle-bag, answer checking (US/UK)

## Phase B: content
- [x] ≥ 1,500 words over 15 categories and A1–C1, Arabic hints, unique example sentences (1,591)
- [x] ≥ 800 dictation sentences (1,589)
- [x] Volume thresholds in the content test; validate:content script

## Phase C: games
- [x] Campaign map, daily challenge, free play filters, Arabic hint fading, celebration, leaderboard flow

## Phase D: navigation, responsive, login, design, copy
- [x] Hamburger menu (focus trap, Esc, outside click, RTL/LTR), bottom bar, footer
- [x] Responsive at 360/390/768/1280/1920, both themes and directions; mobile inputs above the keyboard
- [x] Google + GitHub OAuth, safe redirects, tests; README OAuth steps in Arabic
- [x] Bigger body text, lighter secondary text, opaque header, wide landing, empty states, copy
- [x] Final report + Arabic manual test checklist (tasks/manual-test-checklist-ar.md)

## Phase E: levels and placement
- [x] Root cause of "choosing B1 changes nothing" (DECISIONS E1) and regression tests
- [x] Three stored, synced levels (words, sentences, tests); Dexie v3, export v3, cloud rows migrated
- [x] Stages, bosses, daily and free play read the stored levels on every build; level shown in the game header
- [x] /welcome: choose a level, adaptive placement test (16 items), skip (A2); /play redirects on first visit
- [x] Levels card on /play (change any level, applies to the next game); "retake the placement test" in settings

## Phase F: sentences and messages
- [x] Spell-check dependency checked and reported (DECISIONS F1); lazy, worker-only, on-device
- [x] Checker: dictionary, rule-based confusables, British notes, names/numbers/acronyms skipped, own dictionary; mistake types with Arabic reasons
- [x] Content: 150 scenarios, 300 sentences, 60 messages (A1–C1), original, validated, spell-checked clean
- [x] /write hub, free writing, sentence and message dictation (speed, replay, sentence by sentence, no-voice fallback)
- [x] Tap-to-explain detail, summary (accuracy, types, words to practise), stars, XP, celebration
- [x] Mistakes to SM-2 (bank cards reused, own-word cards with their sentence); review plays them
- [x] History in My progress; Dexie v4, Supabase migration 3, RLS tests; privacy page
