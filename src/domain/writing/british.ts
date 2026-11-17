/**
 * British ↔ American spelling (rule-based). The dictionary is American
 * (en-US), so a British spelling is recognised by turning it into its
 * American form and asking the dictionary about that. Only well-known,
 * regular patterns are covered; irregular pairs are listed.
 */

const PAIRS: Readonly<Record<string, string>> = {
  programme: "program",
  programmes: "programs",
  grey: "gray",
  cheque: "check",
  cheques: "checks",
  tyre: "tire",
  tyres: "tires",
  aluminium: "aluminum",
  mum: "mom",
  plough: "plow",
  jewellery: "jewelry",
  pyjamas: "pajamas",
  enrol: "enroll",
  fulfil: "fulfill",
  skilful: "skillful",
  ageing: "aging",
  judgement: "judgment",
  aeroplane: "airplane",
  aeroplanes: "airplanes",
  practise: "practice",
  practised: "practiced",
  practising: "practicing",
  manoeuvre: "maneuver",
  kerb: "curb",
  storey: "story",
  draught: "draft",
  mould: "mold",
  moustache: "mustache",
  sceptical: "skeptical",
  maths: "math",
  learnt: "learned",
  spelt: "spelled",
  dreamt: "dreamed",
  cosy: "cozy",
  enrolment: "enrollment",
  fulfilment: "fulfillment",
  woollen: "woolen",
  paediatric: "pediatric",
  defence: "defense",
  offence: "offense",
};

/** Suffix rules, British → American. Order matters: the longest patterns come first. */
const RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/isation(s?)$/, "ization$1"],
  [/ise(s|d)?$/, "ize$1"],
  [/ising$/, "izing"],
  [/yse(s|d)?$/, "yze$1"],
  [/ysing$/, "yzing"],
  [/our(s|ed|ing|ite|ites|able|ful)?$/, "or$1"],
  [/tre(s)?$/, "ter$1"],
  [/lled$/, "led"],
  [/lling$/, "ling"],
  [/ller(s?)$/, "ler$1"],
  [/ence(s?)$/, "ense$1"],
  [/ogue(s?)$/, "og$1"],
];

/** American candidates for a possibly British spelling (lower case), most likely first. */
export function americanCandidates(word: string): string[] {
  const w = word.toLowerCase();
  const out: string[] = [];
  const pair = PAIRS[w];
  if (pair) out.push(pair);
  for (const [re, rep] of RULES) if (re.test(w)) out.push(w.replace(re, rep));
  return [...new Set(out)].filter((c) => c !== w);
}

/**
 * The American form of `word` when it is a British spelling of a real word
 * (`isWord` is the American dictionary), otherwise null.
 */
export function britishToAmerican(word: string, isWord: (w: string) => boolean): string | null {
  for (const c of americanCandidates(word)) if (isWord(c)) return c;
  return null;
}

