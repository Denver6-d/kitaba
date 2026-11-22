import { charDistance } from "../spelling/diff";
import { britishToAmerican } from "./british";
import { classifyMistake, type MistakeType } from "./classify";
import { confusableFix, type ConfusablePair } from "./confusables";
import { tokenize, type Token } from "./tokenize";

/**
 * Spelling checker for free writing (DECISIONS F3). The dictionary is
 * injected (nspell in the browser, the same files in tests), so this module
 * stays pure. It checks spelling and a few rule-based confusables only. It
 * never claims to check grammar.
 */

export interface Speller {
  correct(word: string): boolean;
  suggest(word: string): string[];
}

export interface CheckOptions {
  readonly speller: Speller;
  /** The learner's own words (lower case): never flagged. */
  readonly personal?: ReadonlySet<string>;
  readonly accent?: "us" | "uk";
  /** American → British forms from the word bank (color → colour). */
  readonly ukForms?: ReadonlyMap<string, string>;
  /** Common learner words (lower case): preferred among suggestions. */
  readonly bank?: ReadonlySet<string>;
}

export type IssueKind = "spelling" | "confusable" | "note";

export interface Issue {
  readonly start: number;
  readonly end: number;
  /** The word as written. */
  readonly word: string;
  /** The suggested spelling, when there is one. */
  readonly suggestion: string | null;
  readonly kind: IssueKind;
  readonly type: MistakeType;
  readonly pair?: ConfusablePair;
}

export interface TextCheck {
  /** Words checked (names, numbers and the learner's own words included). */
  readonly words: number;
  readonly issues: readonly Issue[];
}

/** Contractions often typed without the apostrophe. Real words (cant, wont, its, were, well, ill, id) are not here. */
const CONTRACTIONS: Readonly<Record<string, string>> = {
  dont: "don't",
  doesnt: "doesn't",
  didnt: "didn't",
  isnt: "isn't",
  arent: "aren't",
  wasnt: "wasn't",
  werent: "weren't",
  havent: "haven't",
  hasnt: "hasn't",
  hadnt: "hadn't",
  couldnt: "couldn't",
  shouldnt: "shouldn't",
  wouldnt: "wouldn't",
  im: "I'm",
  ive: "I've",
  youre: "you're",
  youve: "you've",
  youll: "you'll",
  theyre: "they're",
  theyve: "they've",
  thats: "that's",
  whats: "what's",
  theres: "there's",
  lets: "let's",
  shes: "she's",
  hes: "he's",
};
const SPLITS: Readonly<Record<string, string>> = { alot: "a lot", infront: "in front", eachother: "each other", aswell: "as well", incase: "in case", everytime: "every time" };

/**
 * Common Arabic names and places a learner writes about. Most names are
 * capitalised in the middle of a sentence and skipped anyway; this list
 * covers the first word of a sentence ("Omar is my brother.").
 */
const KNOWN_NAMES = new Set(
  (
    "ahmed ahmad mohammed mohamed mohammad muhammad mahmoud omar umar ali hassan hasan hussein husain khalid khaled youssef yousef yusuf ibrahim ismail hamza " +
    "karim kareem tariq tarek saleh salem saeed said faisal fahad fahd nasser fares majed majid waleed walid ziad rami sami adel amr osama usama bilal anas " +
    "abdullah abdallah abdulrahman hamad hamed jamal jameel kamal mustafa mostafa nabil rashid rashed sultan yasser yaser zaid zayed " +
    "layla leila laila lina nora noura nour noor sara sarah fatima fatma aisha aysha mona muna mariam maryam huda hala rania reem dina salma yasmin yasmine " +
    "hanan samira amal nadia lubna ghada dalia razan rawan shahd jana joud " +
    "khalil haddad saadi nasr " +
    "riyadh jeddah mecca makkah medina madinah dammam doha dubai abu dhabi sharjah ajman muscat manama amman beirut damascus baghdad basra mosul " +
    "sanaa aden khartoum tripoli tunis algiers rabat casablanca marrakesh alexandria giza luxor aswan gaza ramallah hebron nablus irbid aqaba " +
    "ramadan eid hajj umrah"
  ).split(" "),
);

const isAllCaps = (w: string) => w.length >= 2 && w === w.toUpperCase() && /[A-Z]/.test(w);
const capitalize = (w: string) => (w ? (w[0] ?? "").toUpperCase() + w.slice(1) : w);
const isCapitalized = (w: string) => /^[A-Z]/.test(w);
const matchCase = (typed: string, fix: string) => (isCapitalized(typed) && !isCapitalized(fix) ? capitalize(fix) : fix);

/**
 * Spellings one typical learner slip away from `word`: ie/ei swapped, p/b or
 * v/f swapped, a letter doubled or undoubled, two letters swapped. When one of these is a real word
 * it is almost always the intended one ("recieve" is "receive", not "relieve").
 */
export function ruleCandidates(word: string): string[] {
  const w = word.toLowerCase();
  const out: string[] = [];
  for (const m of w.matchAll(/ie|ei/g)) {
    const i = m.index ?? 0;
    out.push(w.slice(0, i) + (m[0] === "ie" ? "ei" : "ie") + w.slice(i + 2));
  }
  const swaps: Record<string, string> = { p: "b", b: "p", v: "f", f: "v" };
  for (let i = 0; i < w.length; i += 1) {
    const c = w[i] ?? "";
    const to = swaps[c];
    if (to) out.push(w.slice(0, i) + to + w.slice(i + 1));
    if (/[a-z]/.test(c) && w[i + 1] !== c && w[i - 1] !== c) out.push(w.slice(0, i + 1) + c + w.slice(i + 1));
    if (w[i + 1] === c) out.push(w.slice(0, i) + w.slice(i + 1));
    // Two neighbouring letters swapped (teh → the).
    const n = w[i + 1];
    if (n && n !== c) out.push(w.slice(0, i) + n + c + w.slice(i + 2));
  }
  return [...new Set(out)].filter((c) => c !== w);
}

/**
 * The best suggestion: a rule candidate that is a real word, a word from the
 * learner word bank (common words a learner is likely to mean), then the
 * closest dictionary suggestion by letters (dictionary order on ties).
 */
function bestSuggestion(word: string, speller: Speller, cache: Map<string, string | null>, bank: ReadonlySet<string>): string | null {
  const key = word.toLowerCase();
  if (cache.has(key)) return cache.get(key) ?? null;
  const fromRules = ruleCandidates(key).filter((c) => speller.correct(c));
  // Common learner words one letter away (recive → receive, wich → which), which nspell may rank below rarer words.
  const fromBank = key.length >= 3 ? [...bank].filter((b) => Math.abs(b.length - key.length) <= 1 && charDistance(key, b) === 1) : [];
  const options = speller.suggest(key).filter((s) => s.split(" ").length <= 2);
  const ranked = [
    ...fromRules.map((s) => ({ s, score: -2 + (bank.has(s) ? -1 : 0) })),
    // A missing or wrong vowel or double letter is the likeliest slip (recive → receive rather than recipe).
    ...fromBank.map((s) => ({ s, score: -1.5 + (["vowel", "double"].includes(classifyMistake(key, s)) ? -0.3 : 0) })),
    ...options.slice(0, 8).map((s) => ({ s, score: charDistance(key, s.toLowerCase()) + (bank.has(s.toLowerCase()) ? -0.5 : 0) })),
  ];
  let best: string | null = null;
  let bestScore = Infinity;
  for (const r of ranked) {
    if (r.score < bestScore) {
      best = r.s;
      bestScore = r.score;
    }
  }
  // nspell only looks one edit away, so two vowel or double-letter slips (prestegeous, sepperate) get nothing or a
  // far-fetched word (desperate). Then a word exactly two such slips away is the likelier one.
  if (bestScore > 1) {
    const slip = twoSlipSuggestion(key, (w) => speller.correct(w), bank);
    if (slip !== null) best = slip;
  }
  cache.set(key, best);
  return best;
}

const SLIP_VOWELS = ["a", "e", "i", "o", "u"];
/** Below this length two slips can reach too many real words to pick one with confidence. */
const MIN_SLIP_LENGTH = 6;

/** Spellings one vowel or double-letter slip from `w`: a vowel swapped for another, a consonant doubled or undoubled. */
export function vowelOrDoubleSlips(w: string): string[] {
  const out = new Set<string>();
  for (let i = 0; i < w.length; i += 1) {
    const c = w[i] ?? "";
    if (SLIP_VOWELS.includes(c)) {
      for (const v of SLIP_VOWELS) if (v !== c) out.add(w.slice(0, i) + v + w.slice(i + 1));
    } else if (/[a-z]/.test(c)) {
      if (w[i + 1] === c) out.add(w.slice(0, i) + w.slice(i + 1));
      else if (w[i - 1] !== c) out.add(w.slice(0, i + 1) + c + w.slice(i + 1));
    }
  }
  out.delete(w);
  return [...out];
}

/**
 * The one real word two vowel or double-letter slips away (prestegeous → prestigious, sepperate → separate),
 * or null when there is none or more than one (a bank word wins over the others). Lower case only, so a
 * misspelling is never turned into a name.
 */
export function twoSlipSuggestion(word: string, isWord: (w: string) => boolean, bank: ReadonlySet<string> = new Set()): string | null {
  if (word.length < MIN_SLIP_LENGTH || !/^[a-z]+$/.test(word)) return null;
  const found = new Set<string>();
  for (const one of vowelOrDoubleSlips(word)) {
    for (const two of vowelOrDoubleSlips(one)) {
      if (two !== word && charDistance(word, two) === 2 && isWord(two)) found.add(two);
    }
  }
  const all = [...found];
  const inBank = all.filter((w) => bank.has(w));
  const pool = inBank.length > 0 ? inBank : all;
  return pool.length === 1 ? (pool[0] ?? null) : null;
}

/** Proper nouns a learner writes often and misspells often: flagged even in mid-sentence. */
const CALENDAR_LIST = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December", "English", "Arabic"];
const CALENDAR = new Set(CALENDAR_LIST);

/** A day, month or language within two letters (wensday → Wednesday), which the dictionary often misses. */
function calendarMatch(lower: string): string | null {
  if (lower.length < 5) return null;
  let best: string | null = null;
  let bestD = 3;
  for (const c of CALENDAR_LIST) {
    const d = charDistance(lower, c.toLowerCase());
    if (d < bestD) {
      best = c;
      bestD = d;
    }
  }
  return best;
}

interface Neighbours {
  readonly prev: string | null;
  readonly next: string | null;
  readonly next2: string | null;
  readonly clauseEnd: boolean;
}

/** Words next to token i in the same clause (no punctuation in between). */
function neighbours(text: string, tokens: readonly Token[], i: number): Neighbours {
  const joined = (a: Token | undefined, b: Token | undefined) => !!a && !!b && /^\s+$/.test(text.slice(a.end, b.start)) && !b.sentenceStart;
  const t = tokens[i];
  const n1 = tokens[i + 1];
  const n2 = tokens[i + 2];
  const p = tokens[i - 1];
  const next = joined(t, n1) ? (n1?.text.toLowerCase() ?? null) : null;
  return {
    prev: joined(p, t) ? (p?.text.toLowerCase() ?? null) : null,
    next,
    next2: next !== null && joined(n1, n2) ? (n2?.text.toLowerCase() ?? null) : null,
    clauseEnd: next === null,
  };
}

export function checkText(text: string, opts: CheckOptions): TextCheck {
  const { speller, personal = new Set<string>(), accent = "us", ukForms = new Map<string, string>(), bank = new Set<string>() } = opts;
  const tokens = tokenize(text);
  const cache = new Map<string, string | null>();
  // A capitalised word used mid-sentence anywhere in the text is a name; it is a name at the start too.
  const namesInText = new Set(tokens.filter((t) => !t.sentenceStart && isCapitalized(t.text)).map((t) => t.text));
  const issues: Issue[] = [];
  const isWord = (w: string) => speller.correct(w);

  const issue = (t: Token, suggestion: string | null, kind: IssueKind, type: MistakeType, pair?: ConfusablePair) => {
    issues.push({ start: t.start, end: t.end, word: t.text, suggestion, kind, type, ...(pair ? { pair } : {}) });
  };

  /** Checks one plain word (no hyphen). Returns the issue to report, or null when it is fine. */
  const checkWord = (word: string, t: Token): { suggestion: string | null; kind: IssueKind; type: MistakeType } | null => {
    const lower = word.toLowerCase();
    if (word === "i") return { suggestion: "I", kind: "spelling", type: "capital" };
    // Loanwords with accents (café, naïve) are not English-dictionary words to correct.
    if (/[^\x00-\x7F]/.test(word)) return null;
    // Possessive 's: names, the learner's own words and British forms are looked up without it (Kareem's, neighbour's).
    const possessive = /'s$/i.test(word) ? "'s" : "";
    const base = possessive ? lower.slice(0, -2) : lower;
    if (isAllCaps(word) || personal.has(lower) || personal.has(base) || KNOWN_NAMES.has(base)) return null;
    if (isWord(word)) {
      // A British learner gets a note only for bank words with a known British form (color → colour), never for
      // words that are also different British words (check/cheque, story/storey, program/programme).
      if (accent === "uk" && !isCapitalized(word)) {
        const uk = ukForms.get(base);
        if (uk) return { suggestion: uk + possessive, kind: "note", type: "british" };
      }
      return null;
    }
    // learners' (plural possessive): check the word without the apostrophe.
    if (word.endsWith("'") && isWord(word.slice(0, -1))) return null;
    const contraction = CONTRACTIONS[lower];
    if (contraction) return { suggestion: matchCase(word, contraction), kind: "spelling", type: "apostrophe" };
    const split = SPLITS[lower];
    if (split) return { suggestion: matchCase(word, split), kind: "spelling", type: "split" };
    const american = britishToAmerican(base, isWord);
    if (american) return accent === "uk" ? null : { suggestion: matchCase(word, american + possessive), kind: "note", type: "british" };
    if (isCapitalized(word)) {
      if (isWord(lower) || (possessive !== "" && isWord(capitalize(base)))) return null;
      // A capitalised unknown word inside a sentence is a name (Kareem, Zarqa), unless it is a misspelled day or month.
      if (!t.sentenceStart || namesInText.has(word) || namesInText.has(capitalize(base))) {
        const c = calendarMatch(base);
        return c ? { suggestion: c + possessive, kind: "spelling", type: classifyMistake(base, c.toLowerCase()) } : null;
      }
      // First word of a sentence: flag it only for a typical learner slip (ie/ei, p/b, v/f, a double or swapped
      // letter) or a day or month, so a name such as Majd or Tabuk is never "corrected" into maid or taboo.
      const s = calendarMatch(base) ?? bestSuggestion(base, speller, cache, bank);
      const common = s !== null && (CALENDAR.has(s) || ruleCandidates(base).includes(s.toLowerCase()));
      if (!s || !common || charDistance(base, s.toLowerCase()) > 2) return null;
      return { suggestion: matchCase(word, s + possessive), kind: "spelling", type: classifyMistake(base, s) };
    }
    // monday → Monday: right letters, missing capital.
    if (isWord(capitalize(word))) return { suggestion: capitalize(word), kind: "spelling", type: "capital" };
    const s = calendarMatch(lower) ?? bestSuggestion(lower, speller, cache, bank);
    return { suggestion: s, kind: "spelling", type: s ? classifyMistake(word, s) : "other" };
  };

  tokens.forEach((t, i) => {
    const parts = t.text.split("-");
    // A hyphenated word the learner added as a whole (al-Ahsa) is fine.
    if (parts.length > 1 && personal.has(t.text.toLowerCase())) return;
    if (parts.length > 1) {
      // well-known, twenty-one: check each part; report the whole token once.
      const fixes = parts.map((p) => (p.length > 1 ? checkWord(p, { ...t, sentenceStart: false }) : null));
      const bad = fixes.findIndex((f) => f !== null && f.kind !== "note");
      if (bad !== -1) {
        const suggestion = parts.map((p, k) => (fixes[k] && fixes[k].kind !== "note" ? (fixes[k].suggestion ?? p) : p)).join("-");
        issue(t, suggestion, "spelling", fixes[bad]?.type ?? "other");
      }
      return;
    }
    const fix = checkWord(t.text, t);
    if (fix) {
      issue(t, fix.suggestion, fix.kind, fix.type);
      return;
    }
    const hit = confusableFix(t.text.toLowerCase(), neighbours(text, tokens, i));
    if (hit) issue(t, matchCase(t.text, hit.suggestion), "confusable", "confusable", hit.pair);
  });

  return { words: tokens.length, issues };
}

/** Mistakes that count against accuracy (notes such as an accepted British spelling do not). */
export const isMistake = (i: Issue): boolean => i.kind !== "note";
