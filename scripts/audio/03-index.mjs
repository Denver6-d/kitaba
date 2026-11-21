/**
 * Step 03 (index): lists the English pronunciation files on Wikimedia Commons
 * whose names follow a known pattern, so a word can be matched by name:
 *
 *   En-us-<word>.<ext>                 US English (the long-standing Commons naming)
 *   En-uk-<word>.<ext>                 British English
 *   LL-Q1860 (eng)-<speaker>-<word>.wav   Lingua Libre recordings in English
 *
 * Only names are listed here; licences and authors are read per file later
 * (05-select). Resumable: each prefix keeps its continue token and the names
 * so far in content-raw/audio/index/, written after every page.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { readJson, writeJson } from "../content/lib/checkpoint.mjs";
import { query } from "./lib/commons.mjs";
import { RAW } from "./lib/paths.mjs";

export const INDEX_DIR = join(RAW, "index");
export const PREFIXES = [
  { id: "en-us", prefix: "En-us-" },
  { id: "en-uk", prefix: "En-uk-" },
  { id: "lingualibre", prefix: "LL-Q1860 (eng)-" },
];

export const indexFile = (id) => join(INDEX_DIR, `${id}.json`);

/** Names of one prefix's files (underscores turned into spaces). */
export function readIndex(id) {
  const f = indexFile(id);
  if (!existsSync(f)) throw new Error(`index ${id} missing: run the index step`);
  const s = readJson(f);
  if (!s.done) throw new Error(`index ${id} is incomplete: run the index step again`);
  return s.files;
}

export async function run({ force = false } = {}) {
  const counts = {};
  for (const { id, prefix } of PREFIXES) {
    const f = indexFile(id);
    let state = !force && existsSync(f) ? readJson(f) : { prefix, done: false, cont: null, files: [] };
    let pages = 0;
    while (!state.done) {
      const body = await query({ list: "allimages", aiprefix: prefix, ailimit: "500", aiprop: "size|mime", ...(state.cont ?? {}) });
      for (const img of body.query.allimages) state.files.push({ name: img.name.replaceAll("_", " "), bytes: img.size, mime: img.mime });
      state = { ...state, cont: body.continue ?? null, done: !body.continue, listedAt: new Date().toISOString() };
      writeJson(f, state);
      if (++pages % 20 === 0) console.log(`  ${id}: ${state.files.length} so far`);
    }
    counts[id] = state.files.length;
  }
  return counts;
}
