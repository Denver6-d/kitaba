/**
 * Arabic hints fade as an item is mastered.
 * mastery = number of recent successes (drops by 2 on a failure).
 */
export type HintLevel = "full" | "partial" | "none";

export function hintLevel(mastery: number): HintLevel {
  if (mastery <= 0) return "full";
  if (mastery < 3) return "partial";
  return "none";
}

export function nextMastery(mastery: number, success: boolean): number {
  return success ? mastery + 1 : Math.max(0, mastery - 2);
}
