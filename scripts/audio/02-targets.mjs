/**
 * Step 02 (targets): the words that get audio, in the order they are made.
 *
 * Targets are the game words with their own Arabic hint (DECISIONS M4): every
 * hand-written bank word, plus every open-data library word whose chunk carries
 * a hint. They are ordered by level (A1 first), then bank words before library
 * words, then by frequency rank, so a run that stops early has covered the
 * words learners meet first. Words whose only hint is the fallback sentence
 * (B2 and C1) get no file and keep Web Speech (owner's decision, DECISIONS AU13).
 *
 * Output: content-raw/audio/targets.json, [{ id, word, level, origin, rank }].
 */
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runStep, writeJson } from "../content/lib/checkpoint.mjs";
import { PIPELINE as CONTENT_PIPELINE } from "../content/lib/paths.mjs";
import { RAW, ROOT } from "./lib/paths.mjs";

const SCRIPT = fileURLToPath(import.meta.url);
export const TARGETS = join(RAW, "targets.json");
const LEVELS = ["A1", "A2", "B1", "B2", "C1"];
const CONTENT = join(ROOT, "public", "content", "v1");
const BANK_DIR = join(ROOT, "src", "data", "words");

/** Same scheme as src/data/words (`wordId`) and src/data/library (`libraryWordId`). */
export const wordId = (word) => `w-${word.replace(/[^a-z0-9]/g, "-")}`;

export async function run({ force = false } = {}) {
  const manifest = join(CONTENT, "manifest.json");
  const { result } = await runStep(RAW, "targets", { script: SCRIPT, inputs: [manifest], outputs: [TARGETS], options: { bank: BANK_DIR }, force: true }, async () => {
    register(pathToFileURL(join(CONTENT_PIPELINE, "lib", "ts-hooks.mjs")));
    const { spellingWords } = await import(pathToFileURL(join(BANK_DIR, "index.ts")).href);
    const out = [];
    for (const w of spellingWords) out.push({ id: w.id, word: w.word, level: w.level, origin: "bank", rank: 0 });
    const { files } = JSON.parse(readFileSync(manifest, "utf8"));
    for (const [key, f] of Object.entries(files)) {
      if (!key.startsWith("words-")) continue;
      const chunk = JSON.parse(readFileSync(join(CONTENT, f.path), "utf8"));
      for (const rows of Object.values(chunk.words)) for (const [word, rank, extra] of rows) if (extra?.ar) out.push({ id: wordId(word), word, level: chunk.level, origin: "library", rank });
    }
    const seen = new Set();
    const targets = out
      .sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) || (a.origin === b.origin ? 0 : a.origin === "bank" ? -1 : 1) || a.rank - b.rank || a.word.localeCompare(b.word))
      .filter((t) => !seen.has(t.id) && seen.add(t.id));
    writeJson(TARGETS, targets);
    const perLevel = Object.fromEntries(LEVELS.map((l) => [l, targets.filter((t) => t.level === l).length]));
    return { total: targets.length, perLevel };
  });
  void force;
  return result;
}
