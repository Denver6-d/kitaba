/** Achievements: pure rules over a summary of the learner's spelling progress. */

export interface AchievementStats {
  readonly games: number;
  /** Words spelled correctly, across every mode (V1 dictation included). */
  readonly correctWords: number;
  readonly longestStreak: number;
  readonly totalStars: number;
  readonly perfectStages: number;
  readonly bossesCleared: number;
  readonly worldsTotal: number;
  readonly bestCombo: number;
  readonly dailyDone: number;
  readonly reviewsDone: number;
  readonly practiceLevel: number;
}

export const EMPTY_STATS: AchievementStats = {
  games: 0,
  correctWords: 0,
  longestStreak: 0,
  totalStars: 0,
  perfectStages: 0,
  bossesCleared: 0,
  worldsTotal: 8,
  bestCombo: 0,
  dailyDone: 0,
  reviewsDone: 0,
  practiceLevel: 1,
};

export interface AchievementDef {
  readonly id: string;
  readonly earned: (s: AchievementStats) => boolean;
}

/**
 * Ids that already existed in V1 (streak-*, spelling-50, level-5) keep their
 * meaning, so V1 unlocks survive the v2 migration.
 */
export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: "first-game", earned: (s) => s.games >= 1 },
  { id: "spelling-50", earned: (s) => s.correctWords >= 50 },
  { id: "words-250", earned: (s) => s.correctWords >= 250 },
  { id: "words-1000", earned: (s) => s.correctWords >= 1000 },
  { id: "perfect-stage", earned: (s) => s.perfectStages >= 1 },
  { id: "stars-60", earned: (s) => s.totalStars >= 60 },
  { id: "first-boss", earned: (s) => s.bossesCleared >= 1 },
  { id: "all-bosses", earned: (s) => s.worldsTotal > 0 && s.bossesCleared >= s.worldsTotal },
  { id: "combo-10", earned: (s) => s.bestCombo >= 10 },
  { id: "daily-7", earned: (s) => s.dailyDone >= 7 },
  { id: "review-50", earned: (s) => s.reviewsDone >= 50 },
  { id: "streak-3", earned: (s) => s.longestStreak >= 3 },
  { id: "streak-7", earned: (s) => s.longestStreak >= 7 },
  { id: "streak-30", earned: (s) => s.longestStreak >= 30 },
  { id: "level-5", earned: (s) => s.practiceLevel >= 5 },
  { id: "level-10", earned: (s) => s.practiceLevel >= 10 },
];

export const ACHIEVEMENT_IDS: ReadonlySet<string> = new Set(ACHIEVEMENTS.map((a) => a.id));

export function earnedAchievements(s: AchievementStats): string[] {
  return ACHIEVEMENTS.filter((a) => a.earned(s)).map((a) => a.id);
}
