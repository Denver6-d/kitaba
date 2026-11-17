/**
 * Word lists and word-relationship heuristics used by the grader.
 * These are deliberately small and explicit: the grader is a heuristic for
 * learner feedback, not a grammar checker.
 */

export const ARTICLES: ReadonlySet<string> = new Set(["a", "an", "the"]);
export const BE_FORMS: ReadonlySet<string> = new Set(["am", "is", "are", "was", "were", "be", "been", "being"]);
export const PREPOSITIONS: ReadonlySet<string> = new Set([
  "in", "on", "at", "to", "for", "of", "with", "from", "by", "about", "into", "onto", "since", "until", "during",
  "under", "over", "between", "after", "before", "near", "behind", "through", "toward", "towards", "across",
]);
export const SUBJECT_PRONOUNS: ReadonlySet<string> = new Set(["i", "you", "he", "she", "it", "we", "they", "who"]);
export const QUANTIFIERS: ReadonlySet<string> = new Set([
  "a", "an", "the", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
  "many", "some", "these", "those", "few", "several", "my", "your", "his", "her", "our", "their", "all", "both", "any", "no",
]);

/** Common base-form verbs (used to tell "she go/goes" from "two brother/brothers"). */
export const VERBS: ReadonlySet<string> = new Set(
  (
    "be have do say go get make know think take see come want look use find give tell work call try ask need feel " +
    "become leave put mean keep let begin seem help talk turn start show hear play run move like live believe hold bring " +
    "happen write sit stand lose pay meet include continue set learn change lead understand watch follow stop create speak " +
    "read spend grow open walk win teach offer remember love consider appear buy wait serve send build stay fall cut reach " +
    "remain suggest raise pass sell decide return explain hope develop carry break receive agree support eat drink sleep " +
    "study travel visit finish arrive cook clean drive fly swim sing dance listen wash wear close miss forget answer apply " +
    "attend book check choose come confirm cost discuss enjoy prefer prepare reply share teach thank wake worry"
  ).split(" "),
);

/** Irregular verb forms → base form. */
const IRREGULAR_VERBS: Readonly<Record<string, string>> = {
  went: "go", gone: "go", goes: "go",
  was: "be", were: "be", been: "be", is: "be", am: "be", are: "be",
  had: "have", has: "have",
  did: "do", done: "do", does: "do",
  ate: "eat", eaten: "eat",
  drank: "drink", drunk: "drink",
  saw: "see", seen: "see",
  came: "come",
  got: "get", gotten: "get",
  gave: "give", given: "give",
  took: "take", taken: "take",
  made: "make",
  wrote: "write", written: "write",
  spoke: "speak", spoken: "speak",
  bought: "buy",
  thought: "think",
  taught: "teach",
  brought: "bring",
  caught: "catch",
  felt: "feel",
  found: "find",
  left: "leave",
  met: "meet",
  paid: "pay",
  said: "say",
  sent: "send",
  slept: "sleep",
  told: "tell",
  understood: "understand",
  stood: "stand",
  sat: "sit",
  knew: "know", known: "know",
  flew: "fly", flown: "fly",
  drove: "drive", driven: "drive",
  broke: "break", broken: "break",
  chose: "choose", chosen: "choose",
  forgot: "forget", forgotten: "forget",
  began: "begin", begun: "begin",
  ran: "run",
  swam: "swim", swum: "swim",
  sang: "sing", sung: "sing",
  woke: "wake", woken: "wake",
  wore: "wear", worn: "wear",
  won: "win",
  lost: "lose",
  kept: "keep",
  built: "build",
  spent: "spend",
  heard: "hear",
  held: "hold",
  led: "lead",
  became: "become",
  grew: "grow", grown: "grow",
  fell: "fall", fallen: "fall",
  sold: "sell",
};

/** Irregular plurals → singular. */
export const IRREGULAR_PLURALS: Readonly<Record<string, string>> = {
  children: "child",
  men: "man",
  women: "woman",
  people: "person",
  feet: "foot",
  teeth: "tooth",
  mice: "mouse",
  wives: "wife",
  knives: "knife",
  lives: "life",
  leaves: "leaf",
};

/** Candidate base forms of a word (over-generating is fine; we only test for overlap). */
export function stems(word: string): Set<string> {
  const out = new Set<string>([word]);
  const irregular = IRREGULAR_VERBS[word] ?? IRREGULAR_PLURALS[word];
  if (irregular) out.add(irregular);
  if (word.endsWith("ies") && word.length > 4) out.add(`${word.slice(0, -3)}y`);
  if (word.endsWith("ied") && word.length > 4) out.add(`${word.slice(0, -3)}y`);
  for (const suffix of ["ing", "ed", "es", "s", "d"]) {
    if (!word.endsWith(suffix) || word.length - suffix.length < 2) continue;
    const stem = word.slice(0, -suffix.length);
    out.add(stem);
    out.add(`${stem}e`);
    const last = stem.at(-1);
    if (last && stem.at(-2) === last) out.add(stem.slice(0, -1)); // stopped → stop
  }
  return out;
}

export function sameBase(a: string, b: string): boolean {
  if (a === b) return false;
  const sa = stems(a);
  for (const s of stems(b)) if (sa.has(s)) return true;
  return false;
}

/** True when the two words differ only by a plural / 3rd-person -s ending. */
export function isSVariant(a: string, b: string): boolean {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (long === `${short}s` || long === `${short}es`) return true;
  if (short.endsWith("y") && long === `${short.slice(0, -1)}ies`) return true;
  if (short.endsWith("y") && long === `${short}s`) return true; // studys (misspelt) vs study(ies)
  if (long.endsWith("s") && stems(long).has(short)) return true;
  return IRREGULAR_PLURALS[long] === short || IRREGULAR_PLURALS[short] === long;
}

export function isIrregularPluralPair(a: string, b: string): boolean {
  return IRREGULAR_PLURALS[a] === b || IRREGULAR_PLURALS[b] === a || stemsHaveIrregularPlural(a, b);
}

function stemsHaveIrregularPlural(a: string, b: string): boolean {
  // e.g. "childs" (wrong) vs "children": both reduce to "child", and one side is an irregular plural
  const plural = IRREGULAR_PLURALS[a] ? a : IRREGULAR_PLURALS[b] ? b : null;
  if (!plural) return false;
  const other = plural === a ? b : a;
  return stems(other).has(IRREGULAR_PLURALS[plural] ?? "");
}

/** Levenshtein distance between two strings. */
export function charDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min((prev[j] ?? 0) + 1, (cur[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    prev = cur;
  }
  return prev[b.length] ?? 0;
}

/**
 * Max character edits for a word to count as a misspelling of the expected word.
 * Words of three letters or fewer get no tolerance: "to"/"go" or "is"/"it" are
 * different words, not misspellings.
 */
export function spellingTolerance(expected: string): number {
  if (expected.length <= 3) return 0;
  return Math.min(3, Math.max(1, Math.floor(expected.length / 3)));
}

export function isSpellingNear(expected: string, actual: string): boolean {
  return charDistance(expected, actual) <= spellingTolerance(expected);
}

const sameClass = (set: ReadonlySet<string>, a: string, b: string) => set.has(a) && set.has(b);

/** Words that are plausibly "the same slot" (cheaper substitution in alignment). */
export function related(a: string, b: string): boolean {
  return (
    sameClass(ARTICLES, a, b) ||
    sameClass(BE_FORMS, a, b) ||
    sameClass(PREPOSITIONS, a, b) ||
    sameBase(a, b) ||
    isSpellingNear(a, b)
  );
}
