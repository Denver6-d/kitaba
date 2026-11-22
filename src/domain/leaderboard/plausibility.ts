/**
 * Client mirror of the checks in submit_score(). The server is the authority;
 * checking here first just avoids sending results that would be rejected.
 * Client-reported scores can never be made fully cheat-proof.
 */

export const LEADERBOARD_RULES = {
  minItems: 5,
  maxItems: 60,
  /** Percent of items answered correctly. */
  minAccuracy: 50,
  /** 10 points × the top combo multiplier (4) + the largest speed bonus (5). */
  maxPointsPerCorrect: 45,
  /**
   * 1.5 s per word: the fastest game the app itself plans for is a Spelling Bee
   * of 40 words in 60 s (BEE_WORDS). Was 1 s (DECISIONS SEC4).
   */
  minSecondsPerItem: 1.5,
  minSecondsBetween: 20,
  /** Games per rolling 24 hours. Was 60 (DECISIONS SEC4). */
  maxPerDay: 30,
} as const;

export type ScoreCheck = "ok" | "too_short" | "low_accuracy" | "implausible";

export interface ScoreInput {
  readonly points: number;
  readonly correct: number;
  readonly total: number;
  readonly durationS: number;
}

const isInt = (n: number) => Number.isInteger(n);

export function checkScore(s: ScoreInput): ScoreCheck {
  const r = LEADERBOARD_RULES;
  if (!isInt(s.total) || !isInt(s.correct) || !isInt(s.points) || !isInt(s.durationS)) return "implausible";
  if (s.total < r.minItems) return "too_short";
  if (s.total > r.maxItems || s.correct < 0 || s.correct > s.total || s.points < 0) return "implausible";
  if (s.correct * 100 < s.total * r.minAccuracy) return "low_accuracy";
  if (s.points > s.correct * r.maxPointsPerCorrect) return "implausible";
  if (s.durationS < s.total * r.minSecondsPerItem || s.durationS > 3600) return "implausible";
  return "ok";
}
