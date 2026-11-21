/**
 * Step 08 (publish): writes what the browser reads, from the render checkpoints.
 *
 *   public/audio/v1/manifest.json              stable name, read network-first
 *   public/audio/v1/index-<LEVEL>.<hash>.json  id -> [file, credit, Commons title]
 *   public/audio/v1/<LEVEL>/<id>.<hash>.mp3    one file per word (07-render)
 *   public/audio/v1/audio-credits.<hash>.tsv   every file with its source, author and licence
 *
 * Hashed names never change content, so they can be cached forever. Files no
 * index refers to any more are deleted. The size budget (lib/budget.mjs) is
 * checked here and again by the content tests.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { readJson, writeAtomic } from "../content/lib/checkpoint.mjs";
import { BUDGET } from "./lib/budget.mjs";
import { OUT } from "./lib/paths.mjs";
import { TARGETS } from "./02-targets.mjs";
import { renderFile } from "./07-render.mjs";

const LEVELS = ["A1", "A2", "B1", "B2", "C1"];
const hash10 = (s) => createHash("sha256").update(s).digest("hex").slice(0, 10);
export const VOICE = { name: "Piper en_US-ljspeech-high", license: "Public domain", url: "https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US/ljspeech/high" };
const CHANGES = "trimmed, loudness-normalised and re-encoded as MP3 (mono, 32 kbps)";

const SOURCE_NAME = { "en-us": "Wikimedia Commons", lingualibre: "Lingua Libre (Wikimedia Commons)", tts: VOICE.name };

export async function run() {
  mkdirSync(OUT, { recursive: true });
  const targets = readJson(TARGETS);
  const levels = {};
  const credits = [];
  const keep = new Set(["manifest.json"]);
  const totals = { files: 0, bytes: 0, human: 0, generated: 0 };

  for (const level of LEVELS) {
    const state = readJson(renderFile(level), null);
    if (!state) continue;
    const creditIdx = new Map();
    const creditRows = [];
    const files = {};
    let audioBytes = 0;
    for (const t of targets.filter((x) => x.level === level)) {
      const r = state.words[t.id];
      if (!r?.file || !existsSync(join(OUT, level, r.file))) continue;
      const bytes = statSync(join(OUT, level, r.file)).size;
      if (bytes > BUDGET.maxFileBytes) throw new Error(`${level}/${r.file} is ${bytes} bytes, over the per-file budget`);
      audioBytes += bytes;
      keep.add(`${level}/${r.file}`);
      if (r.src === "tts") {
        files[t.id] = [r.file, -1];
        totals.generated++;
      } else {
        const key = JSON.stringify([r.author, r.license, r.licenseUrl]);
        if (!creditIdx.has(key)) {
          creditIdx.set(key, creditRows.length);
          creditRows.push([r.author, r.license, r.licenseUrl]);
        }
        files[t.id] = [r.file, creditIdx.get(key), r.title];
        totals.human++;
      }
      credits.push([t.id, t.word, level, SOURCE_NAME[r.src], r.title ?? "", r.page ?? "", r.author ?? "", r.license ?? VOICE.license, r.licenseUrl ?? "", CHANGES]);
    }
    if (!Object.keys(files).length) continue;
    const body = `${JSON.stringify({ level, credits: creditRows, files })}\n`;
    const name = `index-${level}.${hash10(body)}.json`;
    writeAtomic(join(OUT, name), body);
    keep.add(name);
    levels[level] = { index: name, bytes: Buffer.byteLength(body), files: Object.keys(files).length, audioBytes };
    totals.files += Object.keys(files).length;
    totals.bytes += audioBytes;
  }
  if (totals.bytes > BUDGET.totalBytes) throw new Error(`audio is ${totals.bytes} bytes, over the ${BUDGET.totalBytes} budget`);

  const header = [
    "# Pronunciation audio of this site: one row per file.",
    "# Human recordings come from Wikimedia Commons (including Lingua Libre) under the licence named on each row; each was " + CHANGES + ".",
    `# Generated files use the ${VOICE.name} voice (public domain; trained on the public-domain LJ Speech dataset).`,
    "id\tword\tlevel\tsource\tfile\tpage\tauthor\tlicence\tlicence_url\tchanges",
  ].join("\n");
  const tsv = `${header}\n${credits.map((r) => r.map((c) => String(c).replace(/[\t\n]/g, " ")).join("\t")).join("\n")}\n`;
  const creditsName = `audio-credits.${hash10(tsv)}.tsv`;
  writeAtomic(join(OUT, creditsName), tsv);
  keep.add(creditsName);

  const manifest = { version: 1, accent: "us", voice: VOICE, credits: { path: creditsName, bytes: Buffer.byteLength(tsv) }, levels };
  writeAtomic(join(OUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  // Delete files nothing refers to any more (older renders, older indexes).
  let removed = 0;
  for (const entry of readdirSync(OUT, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      for (const f of readdirSync(join(OUT, entry.name))) {
        if (keep.has(`${entry.name}/${f}`)) continue;
        rmSync(join(OUT, entry.name, f));
        removed++;
      }
    } else if (!keep.has(entry.name)) {
      rmSync(join(OUT, entry.name));
      removed++;
    }
  }
  return { ...totals, megabytes: Math.round(totals.bytes / 10_000) / 100, removed, levels: Object.fromEntries(Object.entries(levels).map(([k, v]) => [k, v.files])) };
}
