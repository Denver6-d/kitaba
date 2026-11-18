# Plan: open-data library (2026-11-18)

Earlier plans (V2 phases A–G) are in git history. Licences, sources and decisions are in DECISIONS.md, section "Open data". One commit per phase; lint, typecheck, test, validate:content and build are green before each commit.

| Phase | Scope |
|---|---|
| A | Sources and licences checked, `sources.json` + lock, resumable pipeline skeleton (fetch, extract, checkpoints), licence validation |
| B | Words and levels: lexicon (SCOWL ≤ 60, VarCon, CMU, dictionary-en), Tatoeba frequency, levels by frequency bands, rule-based categories, filters; ≥ 8,000 checked words first, then batches; every existing id kept |
| C | Sentences: Tatoeba filters (quality, length by level, sensitive content, personal data, duplicates and near-duplicates), original fill-ins, sentence ↔ word links, Arabic hints from eng↔ara links, attribution file |
| D | Arabic hints for the 3,000 most frequent words, written in reviewed batches, validated by script |
| E | Lazy chunks + IndexedDB cache, async callers, service-worker runtime cache, "download all for offline", credits page, no counts on the site, size budget, Lighthouse, code-reviewer and test-engineer |
