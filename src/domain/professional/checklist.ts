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
  readonly mustMention: ReadonlyArray<{ readonly anyOf: readonly string[] }>;
}

const GREETING = /^(dear|hello|hi|good (morning|afternoon|evening))\b/i;
const CLOSING = /^(best regards|kind regards|warm regards|regards|sincerely|yours sincerely|yours faithfully|best wishes|many thanks|thanks|thank you|best)\b[ ,!.]*$/i;
const POLITE = /\b(please|thank you|thanks|would you|could you|would it be possible|i would appreciate|i'd appreciate|i would be grateful|kindly)\b/i;
const TEXT_SPEAK = new Set(["u", "ur", "pls", "plz", "thx", "thnx", "tnx", "r", "y", "gonna", "wanna", "lol", "idk", "btw", "msg", "b4"]);

export function wordCount(text: string): number {
  return text.split(/[^A-Za-z0-9']+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
}

const lines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

/** Abbreviations whose full stop does not end a sentence ("10 a.m. works", "Mr. Ali"). */
const ABBREVIATION = /(?:^|\s)(?:a\.m|p\.m|mr|mrs|ms|dr|e\.g|i\.e|etc|no|st)\.$/i;

function splitSentences(line: string): string[] {
  const out: string[] = [];
  for (const part of line.split(/(?<=[.!?])\s+/)) {
    const prev = out.at(-1);
    if (prev !== undefined && ABBREVIATION.test(prev)) out[out.length - 1] = `${prev} ${part}`;
    else if (part) out.push(part);
  }
  return out;
}

/** Index of the closing line ("Best regards,") among the last three lines, or -1. */
function closingIndex(ls: readonly string[]): number {
  for (let i = ls.length - 1; i >= Math.max(0, ls.length - 3); i -= 1) {
    if (CLOSING.test(ls[i] ?? "")) return i;
  }
  return -1;
}

export function checkMessage(text: string, rules: ScenarioRules): CheckResult[] {
  const ls = lines(text);
  const hasGreeting = ls.length > 0 && GREETING.test(ls[0] ?? "");
  const ci = closingIndex(ls);
  const hasClosing = ci !== -1 && ci < ls.length - 1; // a name follows the closing phrase
  const bodyStart = hasGreeting ? 1 : 0;
  const bodyEnd = ci === -1 ? ls.length : ci;
  const body = ls.slice(bodyStart, bodyEnd);

  const sentences = body.flatMap(splitSentences);
  const capitalized =
    sentences.length > 0 &&
    sentences.every((s) => {
      const first = /[A-Za-z]/.exec(s)?.[0];
      return first === undefined || first === first.toUpperCase();
    }) &&
    !/(^|[^A-Za-z'])i(?=[\s,.!?;:']|$)/.test(body.join(" "));

  const punctuated = body.length > 0 && body.every((l) => /[.!?:]["')]?$/.test(l));
  const n = wordCount(text);
  const tokens = text.toLowerCase().split(/[^a-z0-9']+/);
  const lower = ` ${text.toLowerCase().replace(/[^a-z0-9' ]+/g, " ")} `;

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
    // Keywords match at the start of a word, so "apply" also matches "applying".
    results.push({ id: `mention-${i}`, passed: m.anyOf.some((k) => lower.includes(` ${k.toLowerCase()}`)) });
  });
  return results;
}
