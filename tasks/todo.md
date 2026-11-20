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

## Phase G: checks and report
- [x] frontend-design pass, code-reviewer and test-engineer reviews; every confirmed finding fixed with a regression test (DECISIONS G1)
- [x] 360/390/768/1280 px × light/dark × RTL/LTR sweep: no horizontal scroll (G2)
- [x] Lighthouse: Accessibility, Best Practices and SEO 100 on nine pages, mobile and desktop (G3)
- [x] Arabic manual checklist: level choice, placement, changing levels, free writing, message dictation, mistakes to review

## Open data, phase A: sources and pipeline
- [x] Licences read in the sources: SCOWL, VarCon, dictionary-en, Tatoeba, CMUdict; rejected sources recorded (DECISIONS OD1–OD4)
- [x] `scripts/content/sources.json` + `sources.lock.json` (pinned hashes), `content-raw/` git-ignored
- [x] `npm run content:build`: fetch + extract, resumable and checkpointed; licence metadata validated in `validate:content`

## Open data, phase B: words and levels
- [x] Lexicon (SCOWL ≤ 60, dictionary-en, taboo and sensitive filters), Tatoeba frequency, levels by rank bands, rule-based categories (VarCon, CMUdict); 18,466 new words; bank ids unchanged (OD5–OD8)

## Open data, phase C: sentences
- [x] Filtered Tatoeba sentences (form, quality, names allowlist, blocklist, graded vocabulary, the app's checker, near duplicates), examples for 17,441 words, 20 original fill-ins, Arabic translations where linked, credits file (OD9–OD10)

## Open data, phase D: Arabic hints
- [x] Top 3,000 words: 2,192 new hints in ten reviewed batches (808 are bank words with their own hint), hint validator, completeness test (OD11–OD12)

## Open data, phase E: loading, offline, credits
- [x] On-demand loader with a shared content cache (OD13), library words in every game mode and in review, library sentences in dictation with credits and Arabic translations, SW content cache, download-all setting, /credits with notices, no counts, lazy Supabase and a bundle budget (OD14), Lighthouse, reviews

## First-visit level screen
- [x] Central client-side redirect to /welcome on the first visit from any gated page, no flash, return to the page asked for, safe `next`, no loop, cloud levels respected, blocked storage shows the page (L1)
- [x] "Test my level" primary; tests; Arabic checklist

## Google sign-in flag
- [x] Google hidden unless NEXT_PUBLIC_ENABLE_GOOGLE_SIGNIN=true; GitHub and email always shown; .env.example, README (en/ar), tests (O5)

## Redesign "calm luxury" (DESIGN.md V3)

### Phase A: foundation
- [x] Tokens (renamed by role), contrast tested, dark only, `color-scheme: dark`
- [x] IBM Plex Sans Arabic + Inter (Lexend kept as the reading option); light headings
- [x] Western digits through `lib/format.ts`, tested; `%` sign in both languages
- [x] Opaque header, menu without theme switch, bottom bar, footer, logo, icons
- [x] GitHub sign-in removed (code, tests, SPEC, README, privacy, checklist)
- [x] Pill Button (primary is never the default), Chip, Card, Field, Segmented, Switch, Tabs, dialogs; one gold action per screen

### Phase B: welcome, game, correction, result
- [x] Welcome: label, light heading, level preview, gold test with tag, outline choose, quiet skip; mint placement result
- [x] Game: top row (close, gold progress, level chip), title and world / stage / word, gold audio button with rings, slower and sentence pills, letter boxes, hint, labelled input, gold Check
- [x] Correction: marked answer, gold key letters with audio, mint rule card with memory tricks (15 categories), review note
- [x] Stage result: mint card with stars, next-star line, accuracy / XP / streak tiles, review pills, Next stage and Replay
- [x] Placement test on the shared game top row; review session closes in place

### Phase C: landing, motion, sound and haptics, mobile pass, Lighthouse
- [x] Landing: hero with live mini game, three steps, 8 worlds path, mint honest banner; header "Start free" after the hero button scrolls away
- [x] Motion: entry fade-ups (reduced-motion safe), breathing welcome button, rule card slide-up, spring stars, count-ups
- [x] Sounds (correct, wrong, star) and vibration, both off by default, Settings toggles
- [x] Mobile: 360–1440 px audited, touch targets, keyboard inset for sticky Check bars
- [x] Lighthouse 100 / 100 / 100 (accessibility, best practices, SEO), mobile and desktop

## Manual-test fixes (DECISIONS M1–M6)
- [x] No empty letter box after the last letter; length never shown where it is hidden
- [x] "Next" after Check: root cause (button moved between press and release), fix in GameSession, regression test, browser check
- [x] Every game word has a hint: hinted pool, masked-example fallback with Tatoeba translation, hints for library ranks 3,001–4,500
- [x] Rules: verb-endings wording, "Example:" prefix for category tricks, ie/ei Arabic trick, roadmap item
- [x] Sounds and vibration on by default, saved choices kept, nothing before a user gesture
