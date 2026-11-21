import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { audioIndexSchema, audioManifestSchema, type AudioIndex } from "@/data/audio-schema";
import { spellingWords } from "@/data/words";
import { manifestSchema, wordChunkSchema } from "@/data/library-schema";
import { wordsFromChunk } from "@/data/library";
import { LEVELS } from "@/domain/model";
import { BUDGET } from "../../scripts/audio/lib/budget.mjs";

/**
 * The published pronunciation audio (public/audio/v1), part of validate:content
 * (DECISIONS AU7, AU8): schema, content-hashed names, the size budget, and a
 * credit with an allowed licence for every human recording.
 */

const OUT = new URL("../../public/audio/v1/", import.meta.url);
const read = (p: string) => readFileSync(new URL(p, OUT));
const sha10 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex").slice(0, 10);
const manifest = audioManifestSchema.parse(JSON.parse(read("manifest.json").toString("utf8")));
const indexes: AudioIndex[] = Object.values(manifest.levels).map((l) => audioIndexSchema.parse(JSON.parse(read(l!.index).toString("utf8"))));

/** The game words with their own Arabic hint: the targets of the audio pipeline. */
function hintedGameWords(): Map<string, string> {
  const out = new Map(spellingWords.map((w) => [w.id, w.level as string]));
  const CONTENT = new URL("../../public/content/v1/", import.meta.url);
  const m = manifestSchema.parse(JSON.parse(readFileSync(new URL("manifest.json", CONTENT), "utf8")));
  for (const [k, f] of Object.entries(m.files)) {
    if (!k.startsWith("words-")) continue;
    for (const w of wordsFromChunk(wordChunkSchema.parse(JSON.parse(readFileSync(new URL(f.path, CONTENT), "utf8"))))) if (w.ar) out.set(w.id, w.level);
  }
  return out;
}

describe("pronunciation audio", () => {
  it("has a valid manifest, and indexes whose names carry their own hash", () => {
    expect(indexes.length).toBeGreaterThan(0);
    for (const [level, ref] of Object.entries(manifest.levels)) {
      const body = read(ref!.index);
      expect(ref!.index).toBe(`index-${level}.${sha10(body)}.json`);
      expect(ref!.bytes).toBe(body.length);
    }
    const credits = read(manifest.credits.path);
    expect(manifest.credits.path).toBe(`audio-credits.${sha10(credits)}.tsv`);
  });

  // Reads every published file (one per hinted game word, about 5,000): a data-sized timeout.
  it("names every file by its word id and content hash, and every file exists", { timeout: 60_000 }, () => {
    for (const ix of indexes) {
      for (const [id, e] of Object.entries(ix.files)) {
        const p = `${ix.level}/${e[0]}`;
        expect(existsSync(new URL(p, OUT)), p).toBe(true);
        const buf = read(p);
        expect(e[0]).toBe(`${id}.${sha10(buf)}.mp3`);
        // MP3 frame sync (no ID3 tag is written).
        expect(buf[0]).toBe(0xff);
        expect(buf[1]! & 0xe0).toBe(0xe0);
      }
    }
  });

  it("only gives audio to game words with an Arabic hint, at their own level", () => {
    const words = hintedGameWords();
    for (const ix of indexes) for (const id of Object.keys(ix.files)) expect(words.get(id), id).toBe(ix.level);
  });

  it("stays within the size budget", () => {
    let total = 0;
    let files = 0;
    for (const ix of indexes) {
      let level = 0;
      for (const e of Object.values(ix.files)) {
        const bytes = statSync(new URL(`${ix.level}/${e[0]}`, OUT)).size;
        expect(bytes).toBeLessThanOrEqual(BUDGET.maxFileBytes);
        level += bytes;
      }
      expect(manifest.levels[ix.level]!.audioBytes).toBe(level);
      total += level;
      files += Object.keys(ix.files).length;
    }
    expect(total).toBeLessThanOrEqual(BUDGET.totalBytes);
    expect(total / files).toBeLessThanOrEqual(BUDGET.maxAverageBytes);
  });

  it("has no stray files", () => {
    const listed = new Set(indexes.flatMap((ix) => Object.values(ix.files).map((e) => `${ix.level}/${e[0]}`)));
    for (const level of LEVELS) {
      const dir = new URL(`${level}/`, OUT);
      if (!existsSync(dir)) continue;
      for (const f of readdirSync(dir)) expect(listed.has(`${level}/${f}`), `${level}/${f}`).toBe(true);
    }
    const top = new Set(["manifest.json", manifest.credits.path, ...Object.values(manifest.levels).map((l) => l!.index), ...LEVELS]);
    for (const f of readdirSync(OUT)) expect(top.has(f), f).toBe(true);
  });

  it("credits every human recording with an author and an allowed licence", () => {
    for (const ix of indexes) {
      for (const [author, license, url] of ix.credits) {
        expect(author.trim()).not.toBe("");
        expect(license).toMatch(/^(CC BY(-SA)? [34]\.0|CC BY(-SA)? [12]\.[05]|CC0 1\.0|Public domain)$/);
        if (license !== "Public domain") expect(url).toMatch(/^https:\/\/creativecommons\.org\//);
      }
    }
  });

  it("lists every file in the downloadable credits, with its source and licence", () => {
    const rows = read(manifest.credits.path)
      .toString("utf8")
      .split("\n")
      .filter((l) => l && !l.startsWith("#") && !l.startsWith("id\t"))
      .map((l) => l.split("\t"));
    const byId = new Map(rows.map((r) => [r[0], r]));
    for (const ix of indexes) {
      for (const [id, e] of Object.entries(ix.files)) {
        const r = byId.get(id);
        expect(r, id).toBeDefined();
        if (e[1] === -1) expect(r![3]).toMatch(/^Piper/);
        else {
          expect(r![3]).toMatch(/Wikimedia Commons/);
          expect(r![5]).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
          expect(r![6]).toBe(ix.credits[e[1]]![0]);
          expect(r![7]).toBe(ix.credits[e[1]]![1]);
        }
      }
    }
    expect(rows.length).toBe(indexes.reduce((s, ix) => s + Object.keys(ix.files).length, 0));
  });

  it("says every human recording was modified, and that a CC BY-SA one is shared under the same licence", () => {
    const text = read(manifest.credits.path).toString("utf8");
    const rows = text
      .split("\n")
      .filter((l) => l && !l.startsWith("#") && !l.startsWith("id\t"))
      .map((l) => l.split("\t"));
    expect(text).toMatch(/^# .*CC BY-SA recording is shared under the same licence/m);
    let shareAlike = 0;
    for (const r of rows) {
      if (/^Piper/.test(r[3]!)) continue;
      expect(r[9], r[0]).toMatch(/^modified from the original: trimmed, loudness-normalised and converted to MP3/);
      if (/^CC BY-SA /.test(r[7]!)) {
        shareAlike++;
        expect(r[9], r[0]).toContain(`shared under the same licence, ${r[7]}`);
      }
    }
    // Not vacuous once human recordings are published.
    if (indexes.some((ix) => ix.credits.some((c) => c[1].startsWith("CC BY-SA ")))) expect(shareAlike).toBeGreaterThan(0);
  });
});
