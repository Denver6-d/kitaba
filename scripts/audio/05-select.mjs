/**
 * Step 05 (select): for every target word, lists the human recordings that may
 * be used, best first (lib/select.mjs). Each candidate file's licence, author,
 * duration and download URL are read from the Commons API (50 files per
 * request); Lingua Libre pages are also read for their transcription, so a file
 * is used only for the word it says it is.
 *
 * Resumable: file information is cached in content-raw/audio/meta.json after
 * every request. Output: content-raw/audio/selection.json.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { readJson, writeJson } from "../content/lib/checkpoint.mjs";
import { query } from "./lib/commons.mjs";
import { lingualibreByWord, prefixedByWord } from "./lib/names.mjs";
import { RAW } from "./lib/paths.mjs";
import { candidatesFor, chooseSources } from "./lib/select.mjs";
import { TARGETS } from "./02-targets.mjs";
import { readIndex } from "./03-index.mjs";
import { SPEAKERS } from "./04-speakers.mjs";

const META = join(RAW, "meta.json");
export const SELECTION = join(RAW, "selection.json");
const BATCH = 50;
const META_FIELDS = "License|LicenseShortName|LicenseUrl|Artist|Restrictions|AttributionRequired";

async function fetchInfo(titles, cache) {
  const body = await query({ titles: titles.join("|"), prop: "imageinfo", iiprop: "url|size|mime|extmetadata", iiextmetadatafilter: META_FIELDS, iiextmetadatalanguage: "en" });
  const ll = titles.filter((t) => t.startsWith("File:LL-"));
  const texts = new Map();
  if (ll.length) {
    const rv = await query({ titles: ll.join("|"), prop: "revisions", rvprop: "content", rvslots: "main" });
    for (const p of rv.query.pages) if (p.revisions?.[0]) texts.set(p.title, p.revisions[0].slots.main.content);
  }
  const normal = new Map((body.query.normalized ?? []).map((n) => [n.to, n.from]));
  for (const p of body.query.pages) {
    const title = normal.get(p.title) ?? p.title;
    const ii = p.imageinfo?.[0];
    cache[title] = ii
      ? { url: ii.url.split("?")[0], page: ii.descriptionurl, bytes: ii.size, mime: ii.mime, duration: ii.duration, meta: ii.extmetadata ?? {}, ...(texts.has(p.title) ? { wikitext: texts.get(p.title) } : {}) }
      : { missing: true };
  }
  for (const t of titles) cache[t] ??= { missing: true };
}

export async function run({ force = false } = {}) {
  const targets = readJson(TARGETS);
  const words = new Set(targets.map((t) => t.word));
  const enUs = prefixedByWord(readIndex("en-us"), "En-us-", words);
  const lingualibre = lingualibreByWord(readIndex("lingualibre"), words);
  const { speakers } = readJson(SPEAKERS);
  const order = Object.keys(speakers);
  const ctx = { enUs, lingualibre, speakerAccent: (s) => speakers[s]?.accent ?? null, speakerRank: (s) => order.indexOf(s) };

  const perWord = targets.map((t) => ({ t, candidates: candidatesFor(t.word, ctx) }));
  const cache = !force && existsSync(META) ? readJson(META) : {};
  const todo = [...new Set(perWord.flatMap((w) => w.candidates.map((c) => c.title)))].filter((title) => !cache[title]);
  for (let i = 0; i < todo.length; i += BATCH) {
    await fetchInfo(todo.slice(i, i + BATCH), cache);
    writeJson(META, cache);
    if ((i / BATCH) % 10 === 9) console.log(`  file information: ${Math.min(i + BATCH, todo.length)} / ${todo.length}`);
  }

  const selection = {};
  const counts = {};
  for (const { t, candidates } of perWord) {
    const { usable, rejected } = chooseSources(t.word, candidates, (title) => (cache[title]?.missing ? undefined : cache[title]));
    selection[t.id] = { word: t.word, level: t.level, usable, rejected };
    const c = (counts[t.level] ??= { words: 0, enUs: 0, lingualibre: 0, none: 0 });
    c.words++;
    if (!usable.length) c.none++;
    else if (usable[0].kind === "en-us") c.enUs++;
    else c.lingualibre++;
  }
  writeJson(SELECTION, selection);
  return counts;
}
