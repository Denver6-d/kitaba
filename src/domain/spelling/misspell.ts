import { shuffle, type Rng } from "../shared/random";

/**
 * Rule-based misspellings: the plausible wrong spellings a learner might
 * write, generated from the mistake patterns of each category (and generic
 * slips as a fallback). Deterministic for a given rng.
 */

export interface MisspellWord {
  readonly word: string;
  readonly uk?: string | undefined;
  readonly category: string;
}

type Rule = (w: string) => string[];

const VOWELS = "aeiou";
const isVowel = (c: string | undefined) => c !== undefined && VOWELS.includes(c);
const isConsonant = (c: string | undefined) => c !== undefined && /[a-z]/.test(c) && !VOWELS.includes(c);

/** Every result of replacing one occurrence of `from` with `to`. */
function replaceEach(w: string, from: string | RegExp, to: string): string[] {
  const out: string[] = [];
  const re = typeof from === "string" ? new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g") : new RegExp(from.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(w))) {
    out.push(w.slice(0, m.index) + to + w.slice(m.index + m[0].length));
    if (m[0].length === 0) re.lastIndex += 1;
  }
  return out;
}

const collapseDoubles: Rule = (w) => {
  const out: string[] = [];
  for (let i = 1; i < w.length; i += 1) if (w[i] === w[i - 1] && isConsonant(w[i])) out.push(w.slice(0, i) + w.slice(i + 1));
  return out;
};

const doubleSingles: Rule = (w) => {
  const out: string[] = [];
  for (let i = 1; i < w.length - 1; i += 1) {
    const c = w[i];
    if (isConsonant(c) && w[i - 1] !== c && w[i + 1] !== c && isVowel(w[i - 1]) && "bcdfglmnprst".includes(c ?? "")) {
      out.push(w.slice(0, i) + c + w.slice(i));
    }
  }
  return out;
};

const swapIeEi: Rule = (w) => [...replaceEach(w, "ie", "ei"), ...replaceEach(w, "ei", "ie")];

const SILENT: ReadonlyArray<[RegExp, string]> = [
  [/^kn/, "n"],
  [/^wr/, "r"],
  [/^wh/, "w"],
  [/mb$/, "m"],
  [/mb(?=[a-z])/, "m"],
  [/gh/, ""],
  [/gn/, "n"],
  [/bt/, "t"],
  [/stl/, "sl"],
  [/sten/, "sen"],
  [/^ps/, "s"],
  [/^h(?=o[nu])/, ""],
  [/lk/, "k"],
  [/lm/, "m"],
  [/ld/, "d"],
  [/sc(?=[ie])/, "s"],
  [/dg/, "g"],
  [/tch/, "ch"],
  [/rh/, "r"],
  [/ui/, "u"],
  [/e$/, ""],
];
const dropSilent: Rule = (w) => SILENT.flatMap(([re, to]) => replaceEach(w, re, to));

const swapPB: Rule = (w) => [...replaceEach(w, "p", "b"), ...replaceEach(w, "b", "p")];
const swapVF: Rule = (w) => [...replaceEach(w, "v", "f"), ...replaceEach(w, "f", "v"), ...replaceEach(w, "ph", "f")];

const swapVowels: Rule = (w) => {
  const out: string[] = [];
  for (let i = 0; i < w.length; i += 1) {
    const c = w[i];
    if (c === "e" || c === "i" || c === "a") {
      for (const r of ["e", "i", "a"]) if (r !== c) out.push(w.slice(0, i) + r + w.slice(i + 1));
    }
    if (c === "o") out.push(w.slice(0, i) + "u" + w.slice(i + 1));
    if (c === "u") out.push(w.slice(0, i) + "o" + w.slice(i + 1));
  }
  return out;
};

const dropVowels: Rule = (w) => {
  const out: string[] = [];
  for (let i = 1; i < w.length - 1; i += 1) if (isVowel(w[i]) && isConsonant(w[i - 1])) out.push(w.slice(0, i) + w.slice(i + 1));
  return out;
};

const SUFFIX_SWAPS: ReadonlyArray<[string, string]> = [
  ["able", "ible"],
  ["ible", "able"],
  ["ance", "ence"],
  ["ence", "ance"],
  ["ant", "ent"],
  ["ent", "ant"],
  ["tion", "sion"],
  ["sion", "tion"],
  ["ment", "mant"],
  ["ful", "full"],
  ["ous", "us"],
  ["ary", "ery"],
  ["ery", "ary"],
  ["ise", "ize"],
  ["ize", "ise"],
  ["ly", "ley"],
  ["ally", "aly"],
  ["ily", "yly"],
  ["ness", "nes"],
  ["less", "les"],
  ["ture", "cher"],
  ["cial", "shal"],
  ["tial", "shal"],
];
const swapSuffix: Rule = (w) => SUFFIX_SWAPS.filter(([a]) => w.endsWith(a)).map(([a, b]) => w.slice(0, -a.length) + b);

const PREFIX_SLIPS: Rule = (w) => {
  const out: string[] = [];
  for (const p of ["dis", "mis", "un", "in", "im", "il", "ir", "over", "under", "inter"]) {
    const last = p[p.length - 1];
    if (w.startsWith(p + last)) out.push(p + w.slice(p.length + 1)); // dissatisfied → disatisfied
  }
  for (const [a, b] of [["dis", "diss"], ["mis", "miss"], ["un", "unn"], ["im", "in"], ["il", "in"], ["ir", "in"], ["in", "un"], ["un", "in"]] as const) {
    if (w.startsWith(a) && !w.startsWith(b)) out.push(b + w.slice(a.length));
  }
  return out;
};

const PLURAL_SLIPS: Rule = (w) => {
  const out: string[] = [];
  if (w.endsWith("ies")) out.push(`${w.slice(0, -3)}ys`, `${w.slice(0, -3)}yes`);
  if (/[^aeiou]es$/.test(w)) out.push(w.slice(0, -2) + "s");
  if (/ves$/.test(w)) out.push(`${w.slice(0, -3)}fs`);
  if (/oes$/.test(w)) out.push(w.slice(0, -2) + "s");
  if (/[aeiou]ys$/.test(w)) out.push(`${w.slice(0, -2)}ies`);
  if (/[^s]s$/.test(w) && !w.endsWith("es")) out.push(`${w.slice(0, -1)}es`);
  return out;
};

const ENDING_SLIPS: Rule = (w) => {
  const out: string[] = [];
  const m = /^(.*?)(ing|ed)$/.exec(w);
  if (m) {
    const [, stem = "", end = ""] = m;
    if (stem.length > 1 && stem[stem.length - 1] === stem[stem.length - 2]) out.push(stem.slice(0, -1) + end); // stopping → stoping
    else if (isConsonant(stem[stem.length - 1])) out.push(stem + stem[stem.length - 1] + end, `${stem}e${end}`); // making → makking, makeing
    if (stem.endsWith("i") && end === "ed") out.push(`${stem.slice(0, -1)}yed`); // studied → studyed
    if (end === "ed") out.push(`${stem}t`);
  }
  return out;
};

const BRITISH_AMERICAN: Rule = (w) => [
  ...replaceEach(w, /or$/, "our"),
  ...replaceEach(w, /our$/, "or"),
  ...replaceEach(w, /er$/, "re"),
  ...replaceEach(w, /re$/, "er"),
  ...replaceEach(w, /ize/, "ise"),
  ...replaceEach(w, /ise/, "ize"),
  ...replaceEach(w, /yze$/, "yse"),
  ...replaceEach(w, /yse$/, "yze"),
  ...replaceEach(w, /ense$/, "ence"),
  ...replaceEach(w, /ence$/, "ense"),
  ...replaceEach(w, /og$/, "ogue"),
  ...replaceEach(w, /ogue$/, "og"),
];

const GENERIC: Rule = (w) => {
  const out: string[] = [];
  for (let i = 0; i < w.length - 1; i += 1) if (w[i] !== w[i + 1]) out.push(w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2));
  return [...out, ...collapseDoubles(w), ...dropVowels(w), ...swapVowels(w)];
};

const BY_CATEGORY: Readonly<Record<string, readonly Rule[]>> = {
  common: [collapseDoubles, doubleSingles, swapVowels, dropSilent, swapSuffix],
  homophones: [swapVowels, dropSilent],
  "double-letters": [collapseDoubles, doubleSingles],
  "silent-letters": [dropSilent],
  "ie-ei": [swapIeEi],
  plurals: [PLURAL_SLIPS],
  "verb-endings": [ENDING_SLIPS],
  "adverbs-ly": [swapSuffix, collapseDoubles, doubleSingles],
  prefixes: [PREFIX_SLIPS, collapseDoubles],
  suffixes: [swapSuffix, collapseDoubles],
  "british-american": [BRITISH_AMERICAN],
  "p-b": [swapPB],
  "v-f": [swapVF],
  "short-vowels": [dropVowels, swapVowels],
  "vowel-confusion": [swapVowels],
};

/** The pattern-based candidates for a word, best first, without duplicates. */
export function misspellingCandidates(w: MisspellWord): string[] {
  const primary = (BY_CATEGORY[w.category] ?? []).flatMap((r) => r(w.word));
  return [...new Set([...primary, ...GENERIC(w.word)])];
}

const plausible = (s: string) => /^[a-z]+(?:['-][a-z]+)*$/.test(s) && s.length >= 2 && !/(.)\1\1/.test(s);

/**
 * Up to `n` distinct misspellings of the word. Never returns the word itself,
 * its other accepted variant (outside the british-american category), or any
 * spelling in `avoid` (e.g. other real words from the bank).
 */
export function misspellings(w: MisspellWord, n: number, rng: Rng, avoid: ReadonlySet<string> = new Set()): string[] {
  const banned = new Set([w.word, ...avoid]);
  if (w.uk && w.category !== "british-american") banned.add(w.uk);
  const all = misspellingCandidates(w).filter((c) => plausible(c) && !banned.has(c));
  const primaryCount = (BY_CATEGORY[w.category] ?? []).flatMap((r) => r(w.word)).filter((c) => plausible(c) && !banned.has(c)).length;
  // Prefer the category's own patterns (shuffled), then generic slips (shuffled).
  const primary = shuffle(all.slice(0, primaryCount), rng);
  const generic = shuffle(all.slice(primaryCount), rng);
  return [...new Set([...primary, ...generic])].slice(0, n);
}

/**
 * Letter positions worth blanking in Missing Letters: where the word differs
 * from its most typical misspellings. Falls back to vowels. At most ~40% of
 * the letters, at least one.
 */
export function trickyPositions(w: MisspellWord): number[] {
  const word = w.word;
  const positions = new Set<number>();
  for (const c of misspellingCandidates(w).slice(0, 6)) {
    let start = 0;
    while (start < word.length && word[start] === c[start]) start += 1;
    let endW = word.length - 1;
    let endC = c.length - 1;
    while (endW > start && endC >= start && word[endW] === c[endC]) {
      endW -= 1;
      endC -= 1;
    }
    for (let i = start; i <= Math.max(start, endW); i += 1) if (/[a-z]/.test(word[i] ?? "")) positions.add(i);
  }
  if (positions.size === 0) for (let i = 1; i < word.length; i += 1) if (isVowel(word[i])) positions.add(i);
  const max = Math.max(1, Math.floor(word.replace(/[^a-z]/g, "").length * 0.4));
  const sorted = [...positions].filter((i) => i < word.length).sort((a, b) => a - b);
  return (sorted.length > 0 ? sorted : [Math.floor(word.length / 2)]).slice(0, max);
}

export function maskWord(word: string, positions: readonly number[]): string {
  const set = new Set(positions);
  return [...word].map((c, i) => (set.has(i) ? "_" : c)).join("");
}

/** Shuffled letters that never spell the word itself (unless every arrangement does). */
export function scramble(word: string, rng: Rng): string[] {
  const letters = [...word];
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const s = shuffle(letters, rng);
    if (s.join("") !== word) return s;
  }
  return [...letters].reverse();
}
