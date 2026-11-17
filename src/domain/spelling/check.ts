import { letterDiff, type DiffSegment } from "./diff";

export type Accent = "us" | "uk";

export interface CheckableWord {
  readonly word: string;
  readonly uk?: string | undefined;
  readonly category: string;
}

export type Verdict = "correct" | "other-variant" | "wrong";

export interface CheckResult {
  readonly verdict: Verdict;
  /** True for "correct" and "other-variant". */
  readonly accepted: boolean;
  /** The spelling the learner was asked for (in their chosen variant). */
  readonly expected: string;
  readonly answer: string;
  /** Letter diff of the answer against the expected spelling (empty when correct). */
  readonly diff: readonly DiffSegment[];
}

/** Trim, lower-case, straight apostrophes, single spaces. */
export function normalizeAnswer(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[‘’ʼ`]/g, "'")
    .replace(/\s+/g, " ");
}

/** The spelling a learner is asked for in their chosen variant. */
export function expectedSpelling(w: CheckableWord, accent: Accent): string {
  return accent === "uk" && w.uk ? w.uk : w.word;
}

/**
 * Checks an answer (DECISIONS V6). The chosen variant is "correct". The other
 * variant is accepted with a note, except in the british-american category,
 * where the variant itself is what is being tested.
 */
export function checkAnswer(w: CheckableWord, rawAnswer: string, accent: Accent): CheckResult {
  const answer = normalizeAnswer(rawAnswer);
  const expected = expectedSpelling(w, accent);
  if (answer === expected) return { verdict: "correct", accepted: true, expected, answer, diff: [] };
  const other = accent === "uk" ? w.word : w.uk;
  if (other && answer === other && w.category !== "british-american") {
    return { verdict: "other-variant", accepted: true, expected, answer, diff: [] };
  }
  return { verdict: "wrong", accepted: false, expected, answer, diff: letterDiff(answer, expected) };
}
