# Plan: fixes from the owner's manual test (2026-11-21)

Earlier plans (V2 phases A–G, open data A–E, redesign A–C) are in git history. Decisions: DECISIONS.md, section "Manual-test fixes" (M1…).
One commit at the end. Before it: lint, typecheck, test, validate:content, build; code-reviewer agent. No push, no new dependency, no env file touched.

| # | Problem | Approach |
|---|---|---|
| 1 | An empty dashed box stays after the last letter | `LetterBoxes` renders typed letters only (no "next letter" box); the input's caret marks the position. Server-rendered test: N letters give N boxes, nothing else. Length stays hidden wherever it was hidden (R12). |
| 2 | Gold "Next" sometimes does nothing | Reproduce with real mouse and touch input in headless Chrome over CDP (no new dependency). Find what changes under the pointer between press and release, fix it in `GameSession` for every mode, regression test on the pure part plus a scripted browser check. |
| 3 | Some game words have no hint | (a) Pure `gamePool`: words with an Arabic hint first; when a level is short, words with a fallback hint (example sentence with the word masked, plus its Tatoeba Arabic translation when one exists); words with neither never play. Used by stages, bosses and free play (daily is bank-only, all hinted). (b) `maskWord` hides the word and its look-alike forms so the hint never spells it. (c) Step 09 carries example translations into the word chunks; loader and schema read them; credit shown. (d) New hint batches 11+ for library ranks 3,001–4,500 (the rest of B1, the level every world uses), validated by step 06; TOP raised so every A1–B1 library word must have one. Counts in DECISIONS only. |
| 4 | Rules content | verb-endings rule rewritten (ar/en); `trickWords` per category and a pure `trickFor` that adds "مثال:" / "Example:" when the missed word is not the trick's word (tested); new ie-ei Arabic trick; roadmap item in SPEC. |

## Order
1. Repro and fix "Next" (2), letter boxes (1).
2. Rules content (4).
3. Hint pool, masking, translations, loader (3a–c), then hint batches (3d), pipeline re-run, content tests.
4. Docs (DECISIONS M…, SPEC roadmap, todo), checks, code-reviewer, fixes, commit.
