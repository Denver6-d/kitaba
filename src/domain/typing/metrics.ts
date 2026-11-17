import { countCorrectChars, type EngineState } from "./engine";

const CHARS_PER_WORD = 5;

export const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Net words per minute: correct characters / 5 per minute. */
export function netWpm(correctChars: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  return round1(correctChars / CHARS_PER_WORD / (elapsedMs / 60_000));
}

/** Raw words per minute: every typed character (right or wrong) / 5 per minute. */
export function rawWpm(typedChars: number, elapsedMs: number): number {
  return netWpm(typedChars, elapsedMs);
}

/** Keystroke accuracy in percent. Corrected mistakes still count as mistakes. */
export function accuracy(correct: number, errors: number): number {
  const total = correct + errors;
  if (total === 0) return 100;
  return round1((correct / total) * 100);
}

/** 100 × (1 − coefficient of variation) of per-second WPM samples, clamped to [0, 100]. */
export function consistency(samples: readonly number[]): number {
  if (samples.length < 2) return 100;
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  if (mean === 0) return 0;
  const variance = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length;
  const cv = Math.sqrt(variance) / mean;
  return round1(Math.max(0, Math.min(100, 100 * (1 - cv))));
}

export interface Metrics {
  readonly elapsedMs: number;
  readonly netWpm: number;
  readonly rawWpm: number;
  readonly accuracy: number;
  readonly consistency: number;
  readonly correctChars: number;
  readonly typedKeystrokes: number;
  readonly errors: number;
  /** WPM for each full second of the test (used for consistency and the results chart). */
  readonly samples: readonly number[];
}

/** Metrics at time `now` (or the end of the test). Pure and O(log length). */
export function computeMetrics(state: EngineState, now: number): Metrics {
  const elapsedMs = state.startedAt === null ? 0 : Math.max(0, now - state.startedAt);
  const typedKeystrokes = state.correctKeystrokes + state.errorKeystrokes;
  const samples = perSecondSamples(state, elapsedMs);
  return {
    elapsedMs,
    netWpm: netWpm(countCorrectChars(state), elapsedMs),
    rawWpm: rawWpm(typedKeystrokes, elapsedMs),
    accuracy: accuracy(state.correctKeystrokes, state.errorKeystrokes),
    consistency: consistency(samples),
    correctChars: countCorrectChars(state),
    typedKeystrokes,
    errors: state.errorKeystrokes,
    samples,
  };
}

function perSecondSamples(state: EngineState, elapsedMs: number): number[] {
  const seconds = Math.floor(elapsedMs / 1000);
  if (state.startedAt === null || seconds === 0) return [];
  const buckets = new Array<number>(seconds).fill(0);
  for (const k of state.log) {
    if (k.kind !== "correct" && k.kind !== "error") continue;
    const i = Math.floor((k.t - state.startedAt) / 1000);
    if (i >= 0 && i < seconds) buckets[i] = (buckets[i] ?? 0) + 1;
  }
  // chars per second → words per minute
  return buckets.map((c) => c * (60 / CHARS_PER_WORD));
}
