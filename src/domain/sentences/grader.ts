import { alignTokens, type AlignOp } from "./align";
import {
  ARTICLES,
  BE_FORMS,
  isIrregularPluralPair,
  isSpellingNear,
  isSVariant,
  PREPOSITIONS,
  QUANTIFIERS,
  sameBase,
  SUBJECT_PRONOUNS,
  VERBS,
  stems,
} from "./classify";
import { APOSTROPHE_LESS, tokenize } from "./normalize";

/**
 * Rule-based sentence grader.
 *
 * HEURISTIC, NOT A GRAMMAR CHECKER: it compares the learner's sentence with a
 * small set of curated accepted answers and explains the differences using
 * explicit rules. It cannot judge sentences that are correct but not in the
 * accepted list (they will be reported as differences).
 */

export type ErrorType =
  | "missing-article"
  | "extra-article"
  | "wrong-article"
  | "missing-be"
  | "extra-be"
  | "preposition"
  | "verb-form"
  | "plural"
  | "word-order"
  | "spelling"
  | "missing-word"
  | "extra-word"
  | "wrong-word";

export const ERROR_TYPES: readonly ErrorType[] = [
  "missing-article",
  "extra-article",
  "wrong-article",
  "missing-be",
  "extra-be",
  "preposition",
  "verb-form",
  "plural",
  "word-order",
  "spelling",
  "missing-word",
  "extra-word",
  "wrong-word",
];

export interface GradedError {
  readonly type: ErrorType;
  /** Word from the accepted answer (missing or replaced). */
  readonly expected?: string;
  /** Word the learner wrote. */
  readonly actual?: string;
}

export type DiffToken =
  | { readonly kind: "equal"; readonly text: string }
  | { readonly kind: "missing"; readonly text: string; readonly error: ErrorType }
  | { readonly kind: "extra"; readonly text: string; readonly error: ErrorType }
  | { readonly kind: "replaced"; readonly text: string; readonly expected: string; readonly error: ErrorType };

export type StyleNote = "start-capital" | "end-punctuation" | "lowercase-i" | "missing-apostrophe";

export interface GradeResult {
  readonly correct: boolean;
  /** 0–1. Minor errors (spelling, articles) cost half a word. */
  readonly score: number;
  /** The accepted answer the learner's sentence was compared with. */
  readonly best: string;
  readonly errors: readonly GradedError[];
  readonly diff: readonly DiffToken[];
  readonly notes: readonly StyleNote[];
}

const MINOR: ReadonlySet<ErrorType> = new Set(["spelling", "missing-article", "extra-article", "wrong-article"]);
export const errorWeight = (t: ErrorType): number => (MINOR.has(t) ? 0.5 : 1);

export function gradeSentence(input: string, accepted: readonly string[]): GradeResult {
  if (accepted.length === 0) throw new Error("gradeSentence needs at least one accepted answer");
  const actual = tokenize(input);

  let bestIndex = 0;
  let bestOps: AlignOp[] = [];
  let bestCost = Infinity;
  accepted.forEach((answer, index) => {
    const { ops, cost } = alignTokens(tokenize(answer), actual);
    if (cost < bestCost) {
      bestCost = cost;
      bestOps = ops;
      bestIndex = index;
    }
  });

  const best = accepted[bestIndex] ?? "";
  const expectedTokens = tokenize(best);
  const { errors, diff } = classifyOps(bestOps);
  const penalty = errors.reduce((sum, e) => sum + errorWeight(e.type), 0);
  const score = errors.length === 0 ? 1 : Math.max(0, 1 - penalty / Math.max(1, expectedTokens.length));

  return {
    correct: errors.length === 0,
    score: Math.round(score * 1000) / 1000,
    best,
    errors,
    diff,
    notes: styleNotes(input),
  };
}

// ---------------------------------------------------------------------------

/** `moved` holds a group id shared by the two halves of one word-order error. */
type Marked = AlignOp & { moved?: number };

function classifyOps(raw: readonly AlignOp[]): { errors: GradedError[]; diff: DiffToken[] } {
  const ops: Marked[] = raw.map((o) => ({ ...o }));
  const errors: GradedError[] = [];
  const diff: DiffToken[] = [];

  markMoves(ops);

  const moveReported = new Set<number>();
  ops.forEach((op, index) => {
    if (op.op === "equal") {
      diff.push({ kind: "equal", text: op.actual });
      return;
    }
    if (op.moved !== undefined) {
      const word = op.op === "ins" ? op.actual : op.expected;
      if (!moveReported.has(op.moved)) {
        moveReported.add(op.moved);
        errors.push({ type: "word-order", expected: word });
      }
      if (op.op === "del") diff.push({ kind: "missing", text: op.expected, error: "word-order" });
      else if (op.op === "ins") diff.push({ kind: "extra", text: op.actual, error: "word-order" });
      else diff.push({ kind: "replaced", text: op.actual, expected: op.expected, error: "word-order" });
      return;
    }
    const next = nextExpected(ops, index);
    const prev = prevExpected(ops, index);
    if (op.op === "del") {
      const type = classifyMissing(op.expected, next);
      errors.push({ type, expected: op.expected });
      diff.push({ kind: "missing", text: op.expected, error: type });
    } else if (op.op === "ins") {
      const type = classifyExtra(op.actual, next, neighbourActuals(ops, index));
      errors.push({ type, actual: op.actual });
      diff.push({ kind: "extra", text: op.actual, error: type });
    } else {
      const type = classifySub(op.expected, op.actual, prev);
      errors.push({ type, expected: op.expected, actual: op.actual });
      diff.push({ kind: "replaced", text: op.actual, expected: op.expected, error: type });
    }
  });

  return { errors, diff };
}

/** A word deleted in one place and inserted elsewhere, or two adjacent swapped words, is a word-order error. */
function markMoves(ops: Marked[]): void {
  let group = 0;
  ops.forEach((op, i) => {
    if (op.op !== "del" || op.moved !== undefined) return;
    const j = ops.findIndex((o, k) => k !== i && o.op === "ins" && o.moved === undefined && o.actual === op.expected);
    if (j !== -1) {
      group += 1;
      op.moved = group;
      (ops[j] as Marked).moved = group;
    }
  });
  for (let i = 0; i + 1 < ops.length; i += 1) {
    const a = ops[i];
    const b = ops[i + 1];
    if (a?.op === "sub" && b?.op === "sub" && a.moved === undefined && a.expected === b.actual && a.actual === b.expected) {
      group += 1;
      a.moved = group;
      b.moved = group;
    }
  }
}

function nextExpected(ops: readonly AlignOp[], index: number): string | undefined {
  for (let k = index + 1; k < ops.length; k += 1) {
    const o = ops[k];
    if (o && o.op !== "ins") return o.expected;
  }
  return undefined;
}

function prevExpected(ops: readonly AlignOp[], index: number): string | undefined {
  for (let k = index - 1; k >= 0; k -= 1) {
    const o = ops[k];
    if (o && o.op !== "ins") return o.expected;
  }
  return undefined;
}

function neighbourActuals(ops: readonly AlignOp[], index: number): string[] {
  const out: string[] = [];
  const before = ops[index - 1];
  const after = ops[index + 1];
  if (before && before.op !== "del") out.push(before.actual);
  if (after && after.op !== "del") out.push(after.actual);
  return out;
}

const isVerbish = (w: string | undefined): boolean => w !== undefined && (VERBS.has(w) || [...stems(w)].some((s) => VERBS.has(s)));

function classifyMissing(word: string, next: string | undefined): ErrorType {
  if (ARTICLES.has(word)) return "missing-article";
  if (BE_FORMS.has(word)) return "missing-be";
  if (word === "to" && next !== undefined && VERBS.has(next)) return "missing-word"; // infinitive "to"
  if (PREPOSITIONS.has(word)) return "preposition";
  return "missing-word";
}

function classifyExtra(word: string, next: string | undefined, neighbours: readonly string[]): ErrorType {
  if (neighbours.includes(word)) return "extra-word"; // repeated word
  if (ARTICLES.has(word)) return "extra-article";
  if (BE_FORMS.has(word)) return "extra-be";
  if (word === "to" && next !== undefined && VERBS.has(next)) return "extra-word";
  if (PREPOSITIONS.has(word)) return "preposition";
  return "extra-word";
}

function classifySub(expected: string, actual: string, prev: string | undefined): ErrorType {
  if (ARTICLES.has(expected) && ARTICLES.has(actual)) return "wrong-article";
  if (BE_FORMS.has(expected) && BE_FORMS.has(actual)) return "verb-form";
  if (PREPOSITIONS.has(expected) && PREPOSITIONS.has(actual)) return "preposition";
  if (isIrregularPluralPair(expected, actual)) return "plural";
  if (sameBase(expected, actual)) {
    if (isSVariant(expected, actual)) {
      if (prev !== undefined && QUANTIFIERS.has(prev)) return "plural";
      if ((prev !== undefined && SUBJECT_PRONOUNS.has(prev)) || isVerbish(expected)) return "verb-form";
      return "plural";
    }
    return "verb-form";
  }
  if (isSpellingNear(expected, actual)) return "spelling";
  return "wrong-word";
}

function styleNotes(input: string): StyleNote[] {
  const text = input.trim();
  if (text === "") return [];
  const notes: StyleNote[] = [];
  const firstLetter = /[A-Za-z]/.exec(text)?.[0];
  if (firstLetter && firstLetter !== firstLetter.toUpperCase()) notes.push("start-capital");
  if (!/[.!?]["')\]]*$/.test(text)) notes.push("end-punctuation");
  if (/(^|[^A-Za-z'])i(?=$|[^A-Za-z]|')/.test(text)) notes.push("lowercase-i");
  const words = text.toLowerCase().split(/[^a-z']+/);
  if (words.some((w) => w in APOSTROPHE_LESS)) notes.push("missing-apostrophe");
  return notes;
}
