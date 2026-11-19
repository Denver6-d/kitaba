/**
 * Step 05: sentences from Tatoeba (CC BY 2.0 FR), filtered, graded and linked.
 *
 * Filters, in order (every rejection is counted in report-sentences.json):
 * 1. form: printable ASCII after straightening quotes, a capital start, one
 *    final . ? or !, only letters, spaces, commas, apostrophes and inner
 *    hyphens (no digits, quotes, brackets, e-mails or URLs), 3–16 words;
 * 2. quality: no -1 review, a known author, and the author is a native
 *    English speaker or the sentence has a +1 review;
 * 3. names and personal data: a capitalised word must be on the reviewed
 *    allowlist (names.json), so real people, brands and news places drop out;
 * 4. sensitive content: the blocklist (both tiers);
 * 5. vocabulary: every word is in the bank or the library (or is a short
 *    function word or a contraction), so the sentence can be graded;
 * 6. the app's own checker (src/domain/writing/check.ts with the real
 *    dictionary) finds nothing to flag, so a learner is never "corrected" on
 *    a library sentence;
 * 7. duplicates: exact (case and punctuation ignored) and near duplicates
 *    (same words in any order, story names collapsed).
 *
 * Level: the hardest word's level, raised by length (LENGTH_BANDS).
 * Each library word gets its best example: the shortest good sentence with the
 * word, not already used by another word. Arabic translations come through
 * eng-ara links, only when the Arabic sentence has no -1 review.
 *
 * Output: content-raw/work/sentences.json and report-sentences.json.
 */
import { register } from "node:module";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readJson, runStep, writeJson } from "./lib/checkpoint.mjs";
import { DOWNLOADS, EXTRACTED, PIPELINE, WORK } from "./lib/paths.mjs";
import { lines, loadBank, loadBlocklist, spellChecker } from "./lib/text.mjs";
import { WORDS } from "./04-words.mjs";

const SCRIPT = fileURLToPath(import.meta.url);
const TATOEBA = join(EXTRACTED, "tatoeba");
const ENG = join(TATOEBA, "eng_sentences_detailed.tsv");
const ARA = join(TATOEBA, "ara_sentences_detailed.tsv");
const LINKS = join(TATOEBA, "eng-ara_links.tsv");
const LANGS = join(TATOEBA, "user_languages", "user_languages.csv");
const REVIEWS = join(DOWNLOADS, "tatoeba", "users_sentences.csv");
const NAMES = join(PIPELINE, "names.json");
const ORIGINAL = join(PIPELINE, "original", "examples.json");
export const SENTENCES_OUT = join(WORK, "sentences.json");
export const SENTENCES_REPORT = join(WORK, "report-sentences.json");

const LEVELS = ["A1", "A2", "B1", "B2", "C1"];
/** Maximum words for each level: a longer sentence is at least the next level. */
const LENGTH_BANDS = [6, 8, 10, 12, 16];
export const MIN_WORDS = 3;
/** Sentences published per level for dictation (examples are always published on top). */
export const PER_LEVEL = 8_000;
/** Bytes per published sentence chunk (before compression). */
export const CHUNK_BYTES = 240_000;
const FORM_RE = /^[A-Z][A-Za-z ,'-]*[A-Za-z][.?!]$/;

const lvl = (i) => LEVELS[Math.max(0, Math.min(4, i))];
const idx = (l) => LEVELS.indexOf(l);

/** Straightens typographic quotes and spaces; returns null when other characters remain. */
export function normalizeText(raw) {
  const t = raw
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[   ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return /^[\x20-\x7E]+$/.test(t) ? t : null;
}

/** "words" in the sense of dictation: space-separated chunks. */
const wordsOf = (t) => t.split(" ");
/** Tokens for vocabulary checks: letters with inner apostrophes and hyphens. */
const tokensOf = (t) => t.match(/[A-Za-z]+(?:['-][A-Za-z]+)*/g) ?? [];

/** Order-free signature for near duplicates: lower-case words, story names collapsed. */
export function signature(text, names) {
  return tokensOf(text)
    .map((w) => (names.has(w) && w !== "I" ? "NAME" : w.toLowerCase()))
    .sort()
    .join(" ");
}

export async function run({ force = false } = {}) {
  const inputs = [ENG, ARA, LINKS, LANGS, REVIEWS, NAMES, WORDS, join(PIPELINE, "blocklist.json"), ORIGINAL];
  const options = { PER_LEVEL, CHUNK_BYTES, LENGTH_BANDS, MIN_WORDS };
  const { result } = await runStep(WORK, "sentences", { script: SCRIPT, inputs, outputs: [SENTENCES_OUT, SENTENCES_REPORT], options, force }, async () => {
    // The app's checker, imported through Node's type stripping (lib/ts-hooks.mjs).
    register(pathToFileURL(join(PIPELINE, "lib", "ts-hooks.mjs")));
    const { checkText, isMistake } = await import("../../src/domain/writing/check.ts");
    const speller = spellChecker();
    const { sentences: blocked } = loadBlocklist();
    const namesJson = readJson(NAMES);
    const names = new Set(Object.entries(namesJson).filter(([k]) => !k.startsWith("$")).flatMap(([, v]) => v));

    const bank = await loadBank();
    const { words: library } = readJson(WORDS);
    const levelOf = new Map();
    for (const w of bank) for (const s of w.uk ? [w.word, w.uk] : [w.word]) levelOf.set(s, w.level);
    for (const w of library) levelOf.set(w.word, w.level);
    const libraryWords = new Set(library.map((w) => w.word));

    const rejected = {};
    const reject = (reason, sample) => {
      const r = (rejected[reason] ??= { count: 0, samples: [] });
      r.count++;
      if (r.samples.length < 8 && sample) r.samples.push(sample);
      return null;
    };

    // Quality signals.
    const negative = new Set();
    const positive = new Set();
    for await (const line of lines(REVIEWS)) {
      const [, id, review] = line.split("\t");
      if (review === "-1") negative.add(Number(id));
      else if (review === "1") positive.add(Number(id));
    }
    const natives = new Set();
    for await (const line of lines(LANGS)) {
      const [lang, level, user] = line.split("\t");
      if (lang === "eng" && level === "5" && user) natives.add(user);
    }

    /** Level of one token, or null when it cannot be graded. */
    const tokenLevel = (tok, first) => {
      if (tok.includes("'")) {
        const base = tok.replace(/'s$/, "");
        if (base !== tok && names.has(base)) return "A1";
        if (/^I'/.test(tok)) return speller.correct(tok) ? "A1" : null;
        // Otherwise it must be a lower-case word (a capital only at the start): "Milton's" is a name.
        if (tok !== tok.toLowerCase() && !first) return null;
        return speller.correct(tok.toLowerCase()) ? "A1" : null;
      }
      if (tok !== tok.toLowerCase()) {
        if (names.has(tok)) return "A1";
        if (!first) return null;
      }
      const w = tok.toLowerCase();
      if (w.includes("-")) {
        const parts = w.split("-").map((p) => tokenLevel(p, false));
        return parts.includes(null) ? null : parts.reduce((a, b) => (idx(a) >= idx(b) ? a : b));
      }
      if (levelOf.has(w)) return levelOf.get(w);
      if (w.length <= 2 && speller.correct(w)) return "A1";
      return null;
    };

    const candidates = [];
    const seenExact = new Set();
    const seenNear = new Set();
    let total = 0;
    for await (const line of lines(ENG)) {
      const [idStr, , raw, author] = line.split("\t");
      if (!raw) continue;
      total++;
      const id = Number(idStr);
      const text = normalizeText(raw);
      if (!text) {
        reject("characters other than plain English", raw);
        continue;
      }
      if (!FORM_RE.test(text) || / -|- |--|''|,,|,[^ ]| ,|\b(Mr|Mrs|Ms|Dr)\b/.test(text) || /(^|[ ,])'|'([ ,.?!]|$)/.test(text)) {
        reject("form (punctuation, digits, symbols or quotes)", text);
        continue;
      }
      const n = wordsOf(text).length;
      if (n < MIN_WORDS || n > LENGTH_BANDS.at(-1)) {
        reject("length", text);
        continue;
      }
      if (negative.has(id)) {
        reject("negative review", text);
        continue;
      }
      if (!author || author === "\\N") {
        reject("no author", text);
        continue;
      }
      if (!natives.has(author) && !positive.has(id)) {
        reject("author not a native English speaker and no positive review", null);
        continue;
      }
      const toks = tokensOf(text);
      const lower = toks.map((t) => t.toLowerCase());
      const hit = lower.find((t) => blocked.has(t) || blocked.has(t.replace(/'s$/, "")));
      if (hit) {
        reject(`sensitive (${blocked.get(hit) ?? blocked.get(hit.replace(/'s$/, ""))})`, null);
        continue;
      }
      let level = 0;
      let ungraded = null;
      for (let i = 0; i < toks.length; i++) {
        const l = tokenLevel(toks[i], i === 0);
        if (l === null) {
          ungraded = toks[i];
          break;
        }
        level = Math.max(level, idx(l));
      }
      if (ungraded !== null) {
        const capitalised = ungraded !== ungraded.toLowerCase() && toks.indexOf(ungraded) > 0;
        reject(capitalised ? "name or capitalised word not on the allowlist" : "word outside the graded vocabulary", text);
        continue;
      }
      const exact = lower.join(" ");
      if (seenExact.has(exact)) {
        reject("duplicate", null);
        continue;
      }
      seenExact.add(exact);
      const sig = signature(text, names);
      if (seenNear.has(sig)) {
        reject("near duplicate", text);
        continue;
      }
      seenNear.add(sig);
      const lengthLevel = LENGTH_BANDS.findIndex((max) => n <= max);
      candidates.push({ id, text, author, level: lvl(Math.max(level, lengthLevel)), n, pos: positive.has(id), lower });
    }

    // The app's checker must find nothing (it is slower, so it runs last, on survivors only).
    const clean = candidates.filter((c) => {
      const issues = checkText(c.text, { speller }).issues.filter(isMistake);
      if (issues.length) reject("flagged by the app's spell checker", `${c.text} [${issues.map((i) => i.word).join(", ")}]`);
      return issues.length === 0;
    });

    // Examples for library words: the shortest good sentence, preferring a positive review, not shared.
    const byWord = new Map();
    for (const c of clean) {
      if (c.n < 4 || c.n > 12) continue;
      for (const t of new Set(c.lower)) {
        if (!libraryWords.has(t)) continue;
        const list = byWord.get(t) ?? [];
        if (list.length < 60) list.push(c);
        byWord.set(t, list);
      }
    }
    const score = (c, word) => (c.level === levelOf.get(word) ? 0 : 4) + (c.pos ? 0 : 2) + Math.abs(c.n - 7) / 3;
    const usedForExample = new Set();
    const examples = {};
    const exampleById = new Map();
    for (const w of [...library].sort((a, b) => a.rank - b.rank)) {
      const list = (byWord.get(w.word) ?? []).filter((c) => !usedForExample.has(c.id)).sort((a, b) => score(a, w.word) - score(b, w.word) || a.id - b.id);
      const best = list[0];
      if (!best) continue;
      usedForExample.add(best.id);
      examples[w.word] = `t${best.id}`;
      exampleById.set(`t${best.id}`, best);
    }

    // Original example sentences for frequent words Tatoeba could not serve (scripts/content/original).
    const original = readJson(ORIGINAL, { examples: {} }).examples;
    let originalCount = 0;
    for (const [word, text] of Object.entries(original)) {
      if (examples[word] || !libraryWords.has(word)) continue;
      const issues = checkText(text, { speller }).issues.filter(isMistake);
      if (issues.length) throw new Error(`original example for "${word}" is flagged: ${text}`);
      if (!tokensOf(text).some((t) => t.toLowerCase() === word)) throw new Error(`original example for "${word}" does not contain it: ${text}`);
      const id = `o${++originalCount}`;
      examples[word] = id;
      exampleById.set(id, { id, text, author: null });
    }

    // Arabic translations through eng-ara links.
    const araById = new Map();
    for await (const line of lines(ARA)) {
      const [id, , text, author] = line.split("\t");
      if (text && author && author !== "\\N" && !negative.has(Number(id))) araById.set(Number(id), { id: Number(id), text: text.trim(), author });
    }
    const arabicFor = new Map();
    for await (const line of lines(LINKS)) {
      const [eng, ara] = line.split("\t").map(Number);
      const a = araById.get(ara);
      if (!a || /[A-Za-z]/.test(a.text) || a.text.length > 200) continue;
      const prev = arabicFor.get(eng);
      if (!prev || (positive.has(a.id) && !positive.has(prev.id))) arabicFor.set(eng, a);
    }

    // Dictation pools: every example plus the best of the rest, per level.
    const published = [];
    for (const level of LEVELS) {
      const atLevel = clean.filter((c) => c.level === level);
      const chosen = atLevel.filter((c) => usedForExample.has(c.id));
      const rest = atLevel
        .filter((c) => !usedForExample.has(c.id))
        .sort((a, b) => Number(b.pos) - Number(a.pos) || Number(arabicFor.has(b.id)) - Number(arabicFor.has(a.id)) || ((a.id * 2654435761) % 2 ** 32) - ((b.id * 2654435761) % 2 ** 32));
      published.push(...chosen, ...rest.slice(0, Math.max(0, PER_LEVEL - chosen.length)));
    }

    // Chunks of at most CHUNK_BYTES per level: { level, authors, rows: [id, text, author#, arabic?] }.
    const chunks = {};
    const credits = [
      "# Sentences from Tatoeba (https://tatoeba.org) used in this app, with their authors.",
      "# Licence: CC BY 2.0 FR (https://creativecommons.org/licenses/by/2.0/fr/). Some sentences are also CC0.",
      "# Changes: selected by filters, typographic quotes and spaces normalised. Text otherwise unchanged.",
      "# Each sentence: https://tatoeba.org/sentences/show/<sentence_id>",
      "sentence_id\tlanguage\tauthor",
    ];
    const creditRow = (id, lang, author) => credits.push(`${id}\t${lang}\t${author}`);
    for (const level of LEVELS) {
      const rows = published.filter((c) => c.level === level).sort((a, b) => a.id - b.id);
      let part = 0;
      let current = null;
      const flush = () => {
        if (current && current.rows.length) chunks[`sentences-${level}-${++part}`] = { level, authors: current.authors, rows: current.rows };
        current = { authors: [], authorIdx: new Map(), rows: [], bytes: 0 };
      };
      flush();
      for (const c of rows) {
        const a = (name) => {
          if (!current.authorIdx.has(name)) current.authorIdx.set(name, current.authors.push(name) - 1);
          return current.authorIdx.get(name);
        };
        const ar = arabicFor.get(c.id);
        const row = [c.id, c.text, a(c.author), ...(ar ? [[ar.id, ar.text, a(ar.author)]] : [])];
        const size = JSON.stringify(row).length + 1;
        if (current.bytes + size > CHUNK_BYTES) flush();
        current.rows.push([c.id, c.text, a(c.author), ...(ar ? [[ar.id, ar.text, a(ar.author)]] : [])]);
        current.bytes += size;
        creditRow(c.id, "eng", c.author);
        if (ar) creditRow(ar.id, "ara", ar.author);
      }
      flush();
    }
    // Example sentences not in the dictation pools still need their credit.
    const inPools = new Set(published.map((c) => c.id));
    for (const [id, c] of exampleById) if (id.startsWith("t") && !inPools.has(c.id)) creditRow(c.id, "eng", c.author);

    const exampleText = Object.fromEntries([...exampleById].map(([id, c]) => [id, [c.text, c.author]]));
    writeJson(SENTENCES_OUT, { $comment: "Generated by 05-sentences.mjs.", chunks, examples, exampleText, credits: `${credits.join("\n")}\n` });
    const tally = (xs) => Object.fromEntries(LEVELS.map((l) => [l, xs.filter((c) => c.level === l).length]));
    const report = {
      english: total,
      candidates: candidates.length,
      clean: clean.length,
      cleanByLevel: tally(clean),
      published: published.length,
      publishedByLevel: tally(published),
      withArabic: published.filter((c) => arabicFor.has(c.id)).length,
      libraryWordsWithExample: Object.keys(examples).length,
      originalExamples: originalCount,
      top3000WithoutExample: library.filter((w) => w.rank <= 3000 && !examples[w.word]).map((w) => w.word),
      rejected,
    };
    writeJson(SENTENCES_REPORT, report);
    return { clean: clean.length, published: published.length, examples: Object.keys(examples).length, chunks: Object.keys(chunks).length };
  });
  return result;
}
