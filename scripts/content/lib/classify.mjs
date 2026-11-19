/**
 * Rule-based spelling categories for library words (pure; the lexicon, the
 * pronunciations and the British forms are injected). The first matching rule
 * wins, in the order of RULES. Every rule names a spelling problem a learner
 * can be taught in one line, which is what a category means in the games.
 */

const CONS = "bcdfghjklmnpqrstvwxz";
const VOWEL_PH = /^(AA|AE|AH|AO|AW|AY|EH|ER|EY|IH|IY|OW|OY|UH|UW)$/;
const PREFIXES = ["under", "inter", "over", "dis", "mis", "non", "pre", "sub", "un", "re", "im", "in", "ir", "il"];
const SUFFIX_RE = /(ness|ment|ful|less|able|ible|tion|sion|ous|ence|ance|ity|ise|ize|ist|ism|ship|hood|ary|ery|ory)$/;

/** Removes stress digits: "DH EH1 R" → ["DH", "EH", "R"]. */
export function phonemes(pron) {
  return pron.split(" ").map((p) => p.replace(/\d$/, ""));
}

function inflectionBase(w, has) {
  // -ies/-ied → y (cities, tried); -ves → f/fe (knives, leaves)
  if (/[^aeiou]ies$/.test(w) && has(`${w.slice(0, -3)}y`)) return "plural-y";
  if (/ves$/.test(w) && (has(`${w.slice(0, -3)}f`) || has(`${w.slice(0, -3)}fe`))) return "plural-f";
  if (/(ch|sh|ss|x|z|o)es$/.test(w) && has(w.slice(0, -2))) return "plural-es";
  return null;
}

function verbBase(w, has) {
  const m = /^(.+?)(ed|ing)$/.exec(w);
  if (!m) return null;
  const [, stem, end] = m;
  if (stem.length < 2) return null;
  if (end === "ed" && /[^aeiou]i$/.test(stem) && has(`${stem.slice(0, -1)}y`)) return "y-i";
  const last = stem.at(-1);
  if (stem.length >= 3 && CONS.includes(last) && stem.at(-2) === last && has(stem.slice(0, -1))) return "double";
  if (has(`${stem}e`) && !has(stem)) return "drop-e";
  if (has(stem) && stem.length >= 3) return "plain";
  return null;
}

function adverbBase(w, has) {
  if (!w.endsWith("ly") || w.length < 5) return false;
  const s = w.slice(0, -2);
  return has(s) || (s.endsWith("i") && has(`${s.slice(0, -1)}y`)) || has(`${s}le`) || (w.endsWith("ally") && has(w.slice(0, -4))) || (w.endsWith("ically") && has(w.slice(0, -4)));
}

function hasIeEi(w, prons) {
  // -ies/-ied/-ier/-iest come from y (cities, tried): that is a plural or ending rule, not ie/ei.
  const core = w.replace(/i(es|ed|er|est)$/, "y");
  if (!/ie|ei/.test(core)) return false;
  // "science", "quiet", "being": i and e in separate syllables (two vowel sounds in a row).
  return !prons.some((p) => {
    const ph = phonemes(p);
    return ph.some((x, i) => VOWEL_PH.test(x) && VOWEL_PH.test(ph[i + 1] ?? ""));
  });
}

function hasSilentLetter(w, prons) {
  if (prons.length === 0) return /^(kn|wr|gn|ps)|mb$|ght/.test(w);
  return prons.every((p) => {
    const ph = phonemes(p);
    const first = ph[0];
    if (/^kn/.test(w) && first === "N") return true;
    if (/^wr/.test(w) && first === "R") return true;
    if (/^gn/.test(w) && first === "N") return true;
    if (/^ps/.test(w) && first === "S") return true;
    if (/^h[aeiou]/.test(w) && VOWEL_PH.test(first)) return true; // hour, honest
    if (/mb(s|ed|ing|er)?$/.test(w) && !ph.includes("B")) return true; // climb, thumb
    if (/(lk|lm)/.test(w) && !ph.includes("L")) return true; // walk, calm
    if (/bt/.test(w) && !ph.includes("B")) return true; // doubt
    if (/(stle|sten)/.test(w) && !ph.includes("T")) return true; // castle, listen
    if (/gh/.test(w) && !ph.includes("G") && !ph.includes("F")) return true; // night, though
    if (/^wh/.test(w) && first === "HH") return true; // who, whole
    return false;
  });
}

function doubleConsonant(w) {
  return /([bcdfgklmnprstz])\1/.test(w);
}

function prefixed(w, has) {
  return PREFIXES.some((p) => w.startsWith(p) && w.length - p.length >= 3 && has(w.slice(p.length)));
}

function reducedVowel(prons) {
  return prons.some((p) => p.split(" ").some((x) => x === "AH0" || x === "IH0" || x === "ER0"));
}

/**
 * Arabic writes short vowels as marks, so learners drop English vowel letters
 * ("chocolate" → "choclate", "family" → "famly"). A word fits when speech drops
 * a written vowel, or when it has three or more vowel sounds spelled with single letters.
 */
function shortVowelWord(w, prons) {
  if (prons.length === 0) return false;
  const groups = (w.replace(/e$/, "").match(/[aeiouy]+/g) ?? []).length;
  return prons.some((p) => {
    const vowels = p.split(" ").filter((x) => /\d$/.test(x)).length;
    if (vowels >= 2 && groups > vowels) return true;
    return vowels >= 3 && !/[aeiou]{2}/.test(w);
  });
}

/** Consonant clusters Arabic speakers break with an extra vowel ("estreet", "sipring"). */
function cluster(w) {
  return /^(s[ptkcmnlw]|thr|chr|scr|spr|str|spl|squ)/.test(w) || /[bcdfgklmnprstvz]{3}/.test(w.replace(/(ch|sh|th|ph|ck|gh|ng)/g, "x"));
}

/**
 * @param {string} w the American spelling
 * @param {{ has: (w: string) => boolean, prons: (w: string) => string[], uk: (w: string) => string | undefined, homophones: (w: string) => string[] }} ctx
 * @returns {string} a spelling category
 */
export function classify(w, ctx) {
  const prons = ctx.prons(w);
  if (ctx.uk(w)) return "british-american";
  if (ctx.homophones(w).length > 0) return "homophones";
  if (inflectionBase(w, ctx.has)) return "plurals";
  const verb = verbBase(w, ctx.has);
  if (verb && verb !== "plain") return "verb-endings";
  if (adverbBase(w, ctx.has)) return "adverbs-ly";
  if (prefixed(w, ctx.has)) return "prefixes";
  if (hasIeEi(w, prons)) return "ie-ei";
  if (hasSilentLetter(w, prons) && /^(kn|wr|gn|ps|h)|mb|lk|lm|bt|stle|sten|gh|^wh/.test(w)) return "silent-letters";
  if (verb === "plain") return "verb-endings";
  if (doubleConsonant(w)) return "double-letters";
  if (SUFFIX_RE.test(w) && w.length >= 6) return "suffixes";
  if (shortVowelWord(w, prons)) return "short-vowels";
  if (cluster(w)) return "common";
  if (w.includes("p")) return "p-b";
  if (w.includes("v")) return "v-f";
  if (reducedVowel(prons) || /(ea|ou|ai|oa|au|ough|ui|eau)/.test(w)) return "vowel-confusion";
  return "common";
}

/**
 * Homophone groups: words with the same pronunciation (stress ignored) and a
 * different spelling. British/American variants of each other and hyphen
 * variants are not homophones for this purpose.
 * @param {Iterable<string>} words
 * @param {(w: string) => string[]} prons
 * @param {(a: string, b: string) => boolean} isVariant
 * @returns {Map<string, string[]>}
 */
export function homophoneGroups(words, prons, isVariant) {
  const byKey = new Map();
  for (const w of words) {
    for (const p of prons(w)) {
      const key = phonemes(p).join(" ");
      if (!byKey.has(key)) byKey.set(key, new Set());
      byKey.get(key).add(w);
    }
  }
  const out = new Map();
  for (const group of byKey.values()) {
    if (group.size < 2) continue;
    for (const w of group) {
      const others = [...group].filter((o) => o !== w && o.replace(/-/g, "") !== w.replace(/-/g, "") && !isVariant(w, o));
      if (others.length) out.set(w, [...new Set([...(out.get(w) ?? []), ...others])]);
    }
  }
  return out;
}
