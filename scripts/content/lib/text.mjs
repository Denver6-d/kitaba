/**
 * Shared text helpers for the content pipeline: streaming line readers, the
 * en-US spell checker (dictionary-en via nspell, both already dependencies),
 * the hand-written word bank, and the reviewed blocklist.
 */
import { createReadStream, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";
import nspell from "nspell";
import { PIPELINE, ROOT } from "./paths.mjs";

/** Iterates the lines of a (possibly huge) text file without loading it. */
export async function* lines(file, encoding = "utf8") {
  const rl = createInterface({ input: createReadStream(file, { encoding }), crlfDelay: Infinity });
  for await (const line of rl) yield line;
}

/** SCOWL word lists are ISO-8859-1. */
export function readLatin1Lines(file) {
  return readFileSync(file, "latin1").split(/\r?\n/).filter(Boolean);
}

let speller = null;
/** The same en-US Hunspell dictionary the browser uses (dictionary-en 4.0.0 = SCOWL 2020.12.07, size 60). */
export function spellChecker() {
  if (!speller) {
    const dir = join(ROOT, "node_modules", "dictionary-en");
    speller = nspell(readFileSync(join(dir, "index.aff")), readFileSync(join(dir, "index.dic")));
  }
  return speller;
}

/** Words flagged NOSUGGEST (`!`) in dictionary-en: its own taboo list. */
export function noSuggestWords() {
  const dic = readFileSync(join(ROOT, "node_modules", "dictionary-en", "index.dic"), "utf8").split(/\r?\n/).slice(1);
  const out = new Set();
  for (const l of dic) {
    const [stem, flags = ""] = l.split("/");
    if (flags.includes("!")) out.add(stem.toLowerCase());
  }
  return out;
}

/** The hand-written bank (src/data/words/*.ts), read through Node's type stripping. */
export async function loadBank() {
  const dir = join(ROOT, "src", "data", "words");
  const files = readdirSync(dir).filter((f) => f.endsWith(".ts") && !["index.ts", "row.ts"].includes(f));
  const out = [];
  for (const f of files) {
    const mod = await import(pathToFileURL(join(dir, f)).href);
    const category = f.replace(/\.ts$/, "");
    for (const rows of Object.values(mod)) {
      if (!Array.isArray(rows)) continue;
      for (const [word, ar, level, example, extra] of rows) out.push({ word, ar, level, example, category, uk: extra?.uk, confusables: extra?.confusables });
    }
  }
  return out;
}

/**
 * The reviewed sensitive-content blocklist (scripts/content/blocklist.json), expanded to simple
 * inflections. `words` applies to the word library and to sentences; `sentences` adds the
 * broader topics that only remove sentences.
 */
export function loadBlocklist() {
  const raw = JSON.parse(readFileSync(join(PIPELINE, "blocklist.json"), "utf8"));
  const expand = (groups) => {
    const out = new Map();
    for (const [group, list] of Object.entries(groups)) for (const w of list) for (const f of inflections(w)) if (!out.has(f)) out.set(f, group);
    return out;
  };
  const words = expand(raw.words);
  const sentences = new Map([...expand(raw.sentences), ...words]);
  return { words, sentences };
}

/** A word plus its regular inflected forms (enough for a blocklist, not a morphology). */
export function inflections(w) {
  const out = new Set([w, `${w}s`, `${w}es`, `${w}ed`, `${w}ing`, `${w}er`, `${w}ers`, `${w}'s`]);
  if (w.endsWith("e")) {
    for (const s of ["d", "r", "rs"]) out.add(w + s);
    out.add(`${w.slice(0, -1)}ing`);
  }
  if (w.endsWith("y")) for (const s of ["ies", "ied", "ier"]) out.add(w.slice(0, -1) + s);
  if (/[^aeiou][aeiou][bdgklmnprt]$/.test(w)) {
    const c = w.at(-1);
    for (const s of ["ed", "ing", "er", "ers"]) out.add(w + c + s);
  }
  return out;
}

/** Lower-case word tokens of an English sentence (letters, inner apostrophes and hyphens). */
export function wordTokens(sentence) {
  return sentence.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) ?? [];
}
