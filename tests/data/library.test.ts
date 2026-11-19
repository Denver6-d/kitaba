import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { manifestSchema, wordChunkSchema, type WordChunk } from "@/data/library-schema";
import { spellingWords } from "@/data/words";
import { ALL_STAGE_IDS, stageDef } from "@/domain/games/campaign";
import { LEVELS } from "@/domain/model";
import { SPELLING_CATEGORIES } from "@/domain/spelling/categories";

/**
 * The open-data library in public/content/v1 (DECISIONS "Open data"). Part of
 * `npm run validate:content`: every chunk must match its schema and its hash,
 * add only words that are not in the hand-written bank, and keep every
 * campaign stage fillable at every level.
 */

const DIR = new URL("../../public/content/v1/", import.meta.url);
const manifest = manifestSchema.parse(JSON.parse(readFileSync(new URL("manifest.json", DIR), "utf8")));
const read = (path: string) => readFileSync(new URL(path, DIR));
const chunks: WordChunk[] = LEVELS.map((l) => {
  const f = manifest.files[`words-${l}`];
  if (!f) throw new Error(`manifest lists no words-${l}`);
  return wordChunkSchema.parse(JSON.parse(read(f.path).toString("utf8")));
});
const library = chunks.flatMap((c) =>
  Object.entries(c.words).flatMap(([category, rows]) => rows.map(([word, rank, extra]) => ({ word, rank, extra, category, level: c.level }))),
);

describe("open-data library", () => {
  it("lists only files that exist, with their exact hash and size, and nothing else", () => {
    const listed = new Set(Object.values(manifest.files).map((f) => f.path));
    for (const f of Object.values(manifest.files)) {
      const data = read(f.path);
      expect(createHash("sha256").update(data).digest("hex"), f.path).toBe(f.sha256);
      expect(data.length, f.path).toBe(f.bytes);
      expect(f.path.includes(f.sha256.slice(0, 10)), f.path).toBe(true);
    }
    for (const f of readdirSync(DIR)) if (f !== "manifest.json") expect(listed.has(f), `${f} is not in the manifest`).toBe(true);
  });

  it("has at least 8,000 checked words, in every level and every category", () => {
    expect(library.length).toBeGreaterThanOrEqual(8000);
    for (const l of LEVELS) expect(library.filter((w) => w.level === l).length, l).toBeGreaterThan(100);
    // A homophone needs its example sentence (it is spoken with it), so homophones arrive with the sentences (phase C).
    for (const c of SPELLING_CATEGORIES.filter((c) => c !== "homophones")) expect(library.filter((w) => w.category === c).length, c).toBeGreaterThan(50);
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

  it("gives British forms only to british-american words and confusables only to homophones", () => {
    for (const w of library) {
      if (w.category === "british-american") expect(w.extra?.uk, w.word).toBeTruthy();
      if (w.extra?.c) {
        expect(w.category, w.word).toBe("homophones");
        expect(w.extra.c).not.toContain(w.word);
      }
    }
  });

  it("keeps every campaign stage fillable at each of its world's levels, bank plus library", () => {
    for (const id of ALL_STAGE_IDS) {
      const d = stageDef(id);
      if (!d) throw new Error(id);
      const inWorld = (c: string) => (d.world.categories as readonly string[]).includes(c);
      for (const l of d.levels) {
        const n = spellingWords.filter((w) => inWorld(w.category) && w.level === l).length + library.filter((w) => inWorld(w.category) && w.level === l).length;
        expect(n, `${id} at ${l}`).toBeGreaterThanOrEqual(d.timed ? 25 : d.items + 2);
      }
    }
  });
});
