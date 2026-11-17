/**
 * Client mirror of the checks in submit_score(). The server is the authority;
 * checking here first just avoids sending results that would be rejected.
 * Client-reported scores can never be made fully cheat-proof.
 */
import type { TestSource } from "@/domain/typing/personal-best";

export const LEADERBOARD_RULES = {
  minDurationS: 30,
  minAccuracy: 90,
  maxWpm: 250,
  minSecondsBetween: 20,
  maxPerDay: 60,
} as const;

export type ScoreCheck = "ok" | "too_short" | "low_accuracy" | "implausible";

export interface ScoreInput {
  readonly wpm: number;
  readonly accuracy: number;
  /** Seconds actually typed (a timed test can end early when the text runs out). */
  readonly durationS: number;
  /** Correct characters typed. */
  readonly chars: number;
}

/**
 * Only the standard timed tests compete. Custom text could be chosen to be easy,
 * and drills, lessons and the diagnostic are not like-for-like.
 */
export function isLeaderboardSource(source: TestSource): boolean {
  return source === "words" || source === "sentences";
}

export function checkScore(s: ScoreInput): ScoreCheck {
  if (!(s.durationS >= LEADERBOARD_RULES.minDurationS)) return "too_short";
  if (!(s.accuracy >= LEADERBOARD_RULES.minAccuracy)) return "low_accuracy";
  if (!(s.wpm >= 0) || s.wpm > LEADERBOARD_RULES.maxWpm || s.accuracy > 100 || !(s.chars >= 0)) return "implausible";
  // WPM must follow from the characters typed in the time taken (net WPM = chars / 5 per minute).
  const derived = s.chars / 5 / (s.durationS / 60);
  if (Math.abs(derived - s.wpm) > Math.max(2, s.wpm * 0.1)) return "implausible";
  return "ok";
}
