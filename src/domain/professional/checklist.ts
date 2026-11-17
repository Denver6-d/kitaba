/**
 * Rule checklist for professional messages. It checks form, not quality:
 * a greeting, a closing with a name, a polite phrase, capitalisation,
 * punctuation, length, no text-speak and the scenario's required points.
 */

export type CheckId =
  | "greeting"
  | "closing"
  | "polite"
  | "capitalization"
  | "punctuation"
  | "length"
  | "noTextSpeak"
  | `mention-${number}`;

export interface CheckResult {
  readonly id: CheckId;
  readonly passed: boolean;
}

export interface ScenarioRules {
  readonly minWords: number;
  readonly maxWords: number;
  /** Keywords (whole words, simple inflections allowed) or the pattern tokens below. */
  readonly mustMention: ReadonlyArray<{ readonly anyOf: readonly string[] }>;
}

const DAYS = "monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|tonight|weekend";
const MONTHS = "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec";

/** Pattern tokens usable in `anyOf`, matched against the raw text. */
export const PATTERNS: Readonly<Record<string, RegExp>> = {
  "@day": new RegExp(`\\b(${DAYS})\\b`, "i"),
  "@date": new RegExp(`\\b(${MONTHS})\\b|\\b\\d{1,2}[/.-]\\d{1,2}([/.-]\\d{2,4})?\\b|\\b\\d{1,2}(st|nd|rd|th)\\b`, "i"),
  "@time": /\b\d{1,2}(:\d{2})?\s?(a\.?\s?m\b\.?|p\.?\s?m\b\.?)|\b\d{1,2}:\d{2}\b|\bo'?clock\b|\b(noon|midday|morning|afternoon|evening)\b/i,
  "@number": /\b\d{3,}\b|#\s?\d+/,
};

const GREETING = /^(dear|hello|hi|good (morning|afternoon|evening)|to whom it may concern)\b/i;
const CLOSING_PHRASE = "best regards|kind regards|warm regards|regards|yours sincerely|yours faithfully|sincerely|best wishes|many thanks|thanks|thank you|best";
const CLOSING_ALONE = new RegExp(`^(${CLOSING_PHRASE})\\b[ ,!.]*$`, "i");
/** "Best regards, Omar" on one line. */
const CLOSING_WITH_NAME = new RegExp(`^(${CLOSING_PHRASE}),\\s*[A-Z][\\w .'-]*$`, "i");
const POLITE = /\b(please|thank you|thanks|would you|could you|would it be possible|i would appreciate|i'd appreciate|i would be grateful|kindly)\b/i;
/** Whole whitespace-separated tokens only, so "R&D" or "U.S." are not text-speak. */
const TEXT_SPEAK = new Set(["u", "ur", "pls", "plz", "thx", "thnx", "tnx", "r", "y", "gonna", "wanna", "lol", "idk", "btw", "msg", "b4"]);
/** Abbreviations whose full stop does not end a sentence ("10 a.m. works", "Mr. Ali"). */
const ABBREVIATION = /(?:^|\s)(?:a\.m|p\.m|mr|mrs|ms|dr|e\.g|i\.e|etc|no|st)\.$/i;

export function wordCount(text: string): number {
  return text.split(/[^A-Za-z0-9'’]+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
}

const lines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

function splitSentences(line: string): string[] {
  const out: string[] = [];
  for (const part of line.split(/(?<=[.!?])\s+/)) {
    const prev = out.at(-1);
    if (prev !== undefined && ABBREVIATION.test(prev)) out[out.length - 1] = `${prev} ${part}`;
    else if (part) out.push(part);
  }
  return out;
}

/** Index of the closing line among the last three lines, and whether it already carries the name. */
function findClosing(ls: readonly string[]): { index: number; withName: boolean } {
  for (let i = ls.length - 1; i >= Math.max(0, ls.length - 3); i -= 1) {
    const l = ls[i] ?? "";
    if (CLOSING_WITH_NAME.test(l)) return { index: i, withName: true };
    if (CLOSING_ALONE.test(l)) return { index: i, withName: false };
  }
  return { index: -1, withName: false };
}

/** Sentences that start with a letter must start with a capital ("3 days ago…" is fine). */
const sentenceCapitalized = (s: string) => {
  const m = /^\W*([A-Za-z])/.exec(s);
  return !m?.[1] || m[1] === m[1].toUpperCase();
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function mentions(text: string, keyword: string): boolean {
  const pattern = PATTERNS[keyword];
  if (pattern) return pattern.test(text);
  // Whole word, allowing simple inflections: "apply" matches "apply"/"applying" but "hear" not "heart".
  return new RegExp(`(^|[^a-z])${escapeRe(keyword.toLowerCase())}(s|es|ed|d|ing)?(?![a-z])`, "i").test(text);
}

export function checkMessage(rawText: string, rules: ScenarioRules): CheckResult[] {
  const text = rawText.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  const ls = lines(text);
  const hasGreeting = ls.length > 0 && GREETING.test(ls[0] ?? "");
  const closing = findClosing(ls);
  const hasClosing = closing.index !== -1 && (closing.withName || closing.index < ls.length - 1);
  const bodyStart = hasGreeting ? 1 : 0;
  const bodyEnd = closing.index === -1 ? ls.length : closing.index;
  const body = ls.slice(bodyStart, bodyEnd);

  const sentences = body.flatMap(splitSentences);
  const capitalized =
    sentences.length > 0 &&
    sentences.every(sentenceCapitalized) &&
    !/(^|[^A-Za-z'])i(?!\.e\.)(?=[\s,.!?;:']|$)/.test(body.join(" "));

  const punctuated = body.length > 0 && body.every((l) => /[.!?:]["')]?$/.test(l));
  const n = wordCount(text);
  const tokens = text
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/^[^a-z0-9]+|[^a-z0-9']+$/g, ""));

  const results: CheckResult[] = [
    { id: "greeting", passed: hasGreeting },
    { id: "closing", passed: hasClosing },
    { id: "polite", passed: POLITE.test(text) },
    { id: "capitalization", passed: capitalized },
    { id: "punctuation", passed: punctuated },
    { id: "length", passed: n >= rules.minWords && n <= rules.maxWords },
    { id: "noTextSpeak", passed: n > 0 && !tokens.some((tk) => TEXT_SPEAK.has(tk)) },
  ];
  rules.mustMention.forEach((m, i) => {
    results.push({ id: `mention-${i}`, passed: m.anyOf.some((k) => mentions(text, k)) });
  });
  return results;
}
