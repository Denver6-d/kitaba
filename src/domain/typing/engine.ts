import { intendedLatin, isArabicChar, isLatinTypable } from "./layout";

/**
 * Typing engine: a pure reducer over keystrokes. Times are injected
 * (milliseconds, any monotonic origin) so the engine is deterministic.
 */

export type KeystrokeKind = "correct" | "error" | "correction" | "layout-mismatch";

export interface Keystroke {
  readonly t: number;
  readonly kind: KeystrokeKind;
  /** Target character at the caret (empty string for corrections). */
  readonly expected: string;
  /** Character produced (empty string for corrections). */
  readonly typed: string;
  /** For layout mismatches: the Latin key the learner most likely meant. */
  readonly intended?: string;
}

export interface EngineState {
  readonly target: string;
  readonly typed: string;
  readonly log: readonly Keystroke[];
  readonly startedAt: number | null;
  readonly lastAt: number | null;
  readonly correctKeystrokes: number;
  readonly errorKeystrokes: number;
  readonly layoutMismatches: number;
  /** Consecutive layout mismatches since the last Latin keystroke. */
  readonly mismatchStreak: number;
  readonly layoutWarning: boolean;
}

export type TypingInput =
  | { readonly kind: "char"; readonly char: string; readonly code?: string; readonly shift?: boolean; readonly t: number }
  | { readonly kind: "backspace"; readonly t: number };

/** Mismatches in a row before we show the "Arabic keyboard is active" hint. */
export const LAYOUT_WARNING_THRESHOLD = 2;

export function createEngine(target: string): EngineState {
  return {
    target,
    typed: "",
    log: [],
    startedAt: null,
    lastAt: null,
    correctKeystrokes: 0,
    errorKeystrokes: 0,
    layoutMismatches: 0,
    mismatchStreak: 0,
    layoutWarning: false,
  };
}

export function isFinished(state: EngineState): boolean {
  return state.target.length > 0 && state.typed.length >= state.target.length;
}

export function applyInput(state: EngineState, input: TypingInput): EngineState {
  if (input.kind === "backspace") {
    if (state.typed.length === 0) return state;
    return {
      ...state,
      typed: state.typed.slice(0, -1),
      lastAt: input.t,
      log: [...state.log, { t: input.t, kind: "correction", expected: "", typed: "" }],
    };
  }

  const { char, t } = input;
  if (isFinished(state)) return state;
  const expected = state.target[state.typed.length] ?? "";

  if (isArabicChar(char) && !isArabicChar(expected)) {
    const intended = intendedLatin(char, input.code, input.shift ?? false);
    const mismatchStreak = state.mismatchStreak + 1;
    const stroke: Keystroke =
      intended === null
        ? { t, kind: "layout-mismatch", expected, typed: char }
        : { t, kind: "layout-mismatch", expected, typed: char, intended };
    return {
      ...state,
      log: [...state.log, stroke],
      layoutMismatches: state.layoutMismatches + 1,
      mismatchStreak,
      layoutWarning: mismatchStreak >= LAYOUT_WARNING_THRESHOLD,
    };
  }

  if (!isLatinTypable(char)) return state;

  const correct = char === expected;
  return {
    ...state,
    typed: state.typed + char,
    startedAt: state.startedAt ?? t,
    lastAt: t,
    log: [...state.log, { t, kind: correct ? "correct" : "error", expected, typed: char }],
    correctKeystrokes: state.correctKeystrokes + (correct ? 1 : 0),
    errorKeystrokes: state.errorKeystrokes + (correct ? 0 : 1),
    mismatchStreak: 0,
    layoutWarning: false,
  };
}

/** Number of characters in the buffer that match the target at the same position. */
export function countCorrectChars(state: EngineState): number {
  let n = 0;
  for (let i = 0; i < state.typed.length; i += 1) {
    if (state.typed[i] === state.target[i]) n += 1;
  }
  return n;
}
