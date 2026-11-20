import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { manifestSchema, sentenceChunkSchema, wordChunkSchema, type SentenceChunk, type WordChunk } from "@/data/library-schema";
import { spellingWords } from "@/data/words";
import { wordsFromChunk } from "@/data/library";
import { ALL_STAGE_IDS, stageDef } from "@/domain/games/campaign";
import { hintFor } from "@/domain/spelling/hint";
import { findWordToken } from "@/domain/games/items";
import { LEVELS } from "@/domain/model";
import { SPELLING_CATEGORIES } from "@/domain/spelling/categories";
import { checkText, isMistake, type Speller } from "@/domain/writing/check";
import { loadBlocklist } from "../../scripts/content/lib/text.mjs";
import { realSpeller } from "../helpers/speller";

/** These two read the whole library and can exceed the 5 s default on a slower or busy machine (DECISIONS R11). */
const SLOW_DATA_TEST_MS = 60_000;

/**
 * The open-data library in public/content/v1 (DECISIONS "Open data"). Part of
 * `npm run validate:content`: every chunk must match its schema and its hash,
 * add only words that are not in the hand-written bank, keep every campaign
 * stage fillable, and every sentence must be credited, allowed and clean.
 */

const DIR = new URL("../../public/content/v1/", import.meta.url);
const manifest = manifestSchema.parse(JSON.parse(readFileSync(new URL("manifest.json", DIR), "utf8")));
const read = (path: string) => readFileSync(new URL(path, DIR));
const keys = (prefix: string) => Object.keys(manifest.files).filter((k) => k.startsWith(prefix));
const load = (key: string) => {
  const f = manifest.files[key];
  if (!f) throw new Error(`manifest lists no ${key}`);
  return JSON.parse(read(f.path).toString("utf8")) as unknown;
};

const wordChunks: WordChunk[] = keys("words-").map((k) => wordChunkSchema.parse(load(k)));
const sentenceChunks: SentenceChunk[] = keys("sentences-").map((k) => sentenceChunkSchema.parse(load(k)));
const library = wordChunks.flatMap((c) =>
  Object.entries(c.words).flatMap(([category, rows]) => rows.map(([word, rank, extra]) => ({ word, rank, extra, category, level: c.level, chunk: c }))),
);
const sentences = sentenceChunks.flatMap((c) => c.rows.map(([id, text, author, ar]) => ({ id, text, author: c.authors[author], level: c.level, ar: ar ? { id: ar[0], text: ar[1], author: c.authors[ar[2]] } : null })));
const examples = wordChunks.flatMap((c) => Object.entries(c.examples).map(([id, [text, a]]) => ({ id, text, author: a >= 0 ? c.authors[a] : null })));
const credits = read(manifest.files["tatoeba-credits"]?.path ?? "missing").toString("utf8");

describe("open-data library: files", () => {
  it("lists only files that exist, with their exact hash and size, and nothing else", () => {
    const listed = new Set(Object.values(manifest.files).map((f) => f.path));
    for (const f of Object.values(manifest.files)) {
      const data = read(f.path);
      expect(createHash("sha256").update(data).digest("hex"), f.path).toBe(f.sha256);
      expect(data.length, f.path).toBe(f.bytes);
      expect(f.path.includes(f.sha256.slice(0, 10)), f.path).toBe(true);
      expect(data.length, `${f.path} is over the chunk budget`).toBeLessThanOrEqual(f.path.endsWith(".tsv") ? 2_000_000 : 300_000);
    }
    for (const f of readdirSync(DIR)) if (f !== "manifest.json") expect(listed.has(f), `${f} is not in the manifest`).toBe(true);
  });
});

describe("open-data library: words", () => {
  it("has at least 8,000 checked words, in every level and every category", () => {
    expect(library.length).toBeGreaterThanOrEqual(8000);
    for (const l of LEVELS) expect(library.filter((w) => w.level === l).length, l).toBeGreaterThan(100);
    for (const c of SPELLING_CATEGORIES) expect(library.filter((w) => w.category === c).length, c).toBeGreaterThan(50);
  });

  it("adds only new words: no duplicate and no clash with a bank spelling or id", () => {
    const bank = new Set(spellingWords.flatMap((w) => (w.uk ? [w.word, w.uk] : [w.word])));
    const bankIds = new Set(spellingWords.map((w) => w.id));
    const seen = new Set<string>();
    for (const w of library) {
      expect(seen.has(w.word), `duplicate ${w.word}`).toBe(false);
      seen.add(w.word);
      expect(bank.has(w.word), `${w.word} is a bank word`).toBe(false);
      expect(bankIds.has(`w-${w.word.replace(/[^a-z0-9]/g, "-")}`), `${w.word} id`).toBe(false);
      if (w.extra?.uk) {
        expect(bank.has(w.extra.uk), `${w.extra.uk} is a bank word`).toBe(false);
        expect(w.extra.uk).not.toBe(w.word);
      }
    }
  });

  it("gives British forms to british-american words, and homophones their confusables and an example", () => {
    for (const w of library) {
      if (w.category === "british-american") expect(w.extra?.uk, w.word).toBeTruthy();
      if (w.category === "homophones") {
        expect(w.extra?.c?.length, w.word).toBeGreaterThan(0);
        expect(w.extra?.ex, `${w.word} is spoken with its example`).toBeTruthy();
      }
      if (w.extra?.c) {
        expect(w.category, w.word).toBe("homophones");
        expect(w.extra.c).not.toContain(w.word);
      }
    }
  });

  it("links every example inside the word's own chunk, and the example contains the word", () => {
    let withExample = 0;
    for (const w of library) {
      if (!w.extra?.ex) continue;
      withExample++;
      const ex = w.chunk.examples[w.extra.ex];
      expect(ex, `${w.word}: ${w.extra.ex}`).toBeDefined();
      expect(findWordToken(ex![0].split(" "), w.word), `${w.word} in "${ex![0]}"`).not.toBe(-1);
    }
    expect(withExample / library.length).toBeGreaterThan(0.9);
  }, SLOW_DATA_TEST_MS);

  it("gives every one of the 4,500 most frequent words (every A1-B1 word) a reviewed Arabic hint (phase D, M4)", () => {
    const missing = library.filter((w) => w.rank <= 4500 && !w.extra?.ar).map((w) => w.word);
    expect(missing).toEqual([]);
    for (const l of ["A1", "A2", "B1"]) expect(library.filter((w) => w.level === l && !w.extra?.ar).map((w) => w.word), l).toEqual([]);
    expect(library.filter((w) => w.extra?.ar).length).toBeGreaterThan(3400);
  });

  it("carries the Tatoeba Arabic translation of an example, credited to its own author (fallback hints, M4)", () => {
    const withTr = wordChunks.flatMap((c) => Object.values(c.examples).flatMap((e) => (e[2] ? [{ tr: e[2], c }] : [])));
    expect(withTr.length).toBeGreaterThan(100);
    for (const { tr, c } of withTr) {
      expect(c.authors[tr[2]], String(tr[0])).toBeTruthy();
      expect(credits).toContain(`
${tr[0]}	ara	${c.authors[tr[2]]}`);
    }
  });

  it("gives every library word without an Arabic hint a usable fallback, or keeps it out of games (M4)", () => {
    const words = wordChunks.flatMap((c) => wordsFromChunk(c));
    const noHint = words.filter((w) => !w.ar);
    const fallback = noHint.filter((w) => hintFor(w) !== null);
    // Most have an example that contains the word; the rest never play (hintedPoolAtLevel).
    expect(fallback.length / noHint.length).toBeGreaterThan(0.9);
    for (const w of fallback) {
      const h = hintFor(w);
      expect(h?.kind).toBe("sentence");
      if (h?.kind !== "sentence") continue;
      // No visible token may contain the word or share its first four letters (a relative that shows the spelling).
      const word = w.word.replace(/-/g, "");
      const shown = h.masked.toLowerCase().replace(/-/g, "").split(/[^a-z']+/).filter(Boolean);
      const leaks = shown.filter((t) => t.includes(word) || (word.length >= 4 && t.length >= 4 && t.slice(0, 4) === word.slice(0, 4)));
      expect(leaks, `${w.word}: ${h.masked}`).toEqual([]);
    }
  }, SLOW_DATA_TEST_MS);

  it("keeps every campaign stage fillable at each of its world's levels with hinted words only, bank plus library", () => {
    const all = [...spellingWords, ...wordChunks.flatMap((c) => wordsFromChunk(c))];
    for (const id of ALL_STAGE_IDS) {
      const d = stageDef(id);
      if (!d) throw new Error(id);
      const inWorld = (c: string) => (d.world.categories as readonly string[]).includes(c);
      for (const l of d.levels) {
        const n = all.filter((w) => inWorld(w.category) && w.level === l && hintFor(w) !== null).length;
        expect(n, `${id} at ${l}`).toBeGreaterThanOrEqual(d.timed ? 25 : d.items + 2);
      }
    }
  }, SLOW_DATA_TEST_MS);
});

describe("open-data library: sentences", () => {
  let speller: Speller;
  beforeAll(() => {
    speller = realSpeller();
  }, 30_000);

  it("has thousands of unique sentences at every level", () => {
    for (const l of LEVELS) expect(sentences.filter((s) => s.level === l).length, l).toBeGreaterThan(2000);
    const ids = sentences.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const norm = sentences.map((s) => s.text.toLowerCase().replace(/[^a-z' ]/g, ""));
    expect(new Set(norm).size).toBe(norm.length);
  });

  it("credits every Tatoeba sentence and translation with its author (CC BY 2.0 FR)", () => {
    expect(credits).toContain("CC BY 2.0 FR");
    const rows = new Map(
      credits
        .split("\n")
        .filter((l) => /^\d/.test(l))
        .map((l) => {
          const [id, lang, author] = l.split("\t");
          return [`${lang}:${id}`, author] as const;
        }),
    );
    for (const s of sentences) {
      expect(rows.get(`eng:${s.id}`), `credit for ${s.id}`).toBe(s.author);
      if (s.ar) expect(rows.get(`ara:${s.ar.id}`), `credit for ara ${s.ar.id}`).toBe(s.ar.author);
    }
    for (const e of examples) if (e.id.startsWith("t")) expect(rows.get(`eng:${e.id.slice(1)}`), `credit for example ${e.id}`).toBe(e.author);
  });

  it("contains no blocked word and no capitalised word outside the allowlist", () => {
    const { sentences: blocked } = loadBlocklist();
    const names = new Set(
      Object.entries(JSON.parse(readFileSync(new URL("../../scripts/content/names.json", import.meta.url), "utf8")) as Record<string, string[]>)
        .filter(([k]) => !k.startsWith("$"))
        .flatMap(([, v]) => v),
    );
    for (const s of [...sentences, ...examples.filter((e) => e.id.startsWith("t"))]) {
      const toks = s.text.match(/[A-Za-z]+(?:['-][A-Za-z]+)*/g) ?? [];
      for (const [i, t] of toks.entries()) {
        const low = t.toLowerCase();
        expect(blocked.has(low) || blocked.has(low.replace(/'s$/, "")), `"${t}" in ${s.text}`).toBe(false);
        // Contractions of "I" (I'm, I've) are words, not names.
        if (i > 0 && t !== low && !/^I'/.test(t)) expect(names.has(t.replace(/'s$/, "")), `"${t}" in ${s.text}`).toBe(true);
      }
    }
  }, SLOW_DATA_TEST_MS);

  it("spell-checks clean with the app's own checker and the real dictionary", () => {
    const flagged = [...sentences, ...examples]
      .map((s) => ({ text: s.text, issues: checkText(s.text, { speller }).issues.filter(isMistake) }))
      .filter((r) => r.issues.length > 0)
      .map((r) => `${r.text} [${r.issues.map((i) => i.word).join(", ")}]`);
    expect(flagged).toEqual([]);
  }, 120_000);
});
