/** Achievements: pure rules over a summary of the learner's progress. */

export interface AchievementStats {
  readonly tests: number;
  readonly bestWpm: number;
  /** Best accuracy in a timed test of at least 60 seconds. */
  readonly bestMinuteAccuracy: number;
  readonly longestStreak: number;
  readonly spellingCorrect: number;
  readonly sentencesCorrect: number;
  readonly scenariosCompleted: number;
  readonly scenariosTotal: number;
  readonly lessonsDone: number;
  readonly lessonsTotal: number;
  readonly diagnosticDone: boolean;
  readonly practiceLevel: number;
}

export const EMPTY_STATS: AchievementStats = {
  tests: 0,
  bestWpm: 0,
  bestMinuteAccuracy: 0,
  longestStreak: 0,
  spellingCorrect: 0,
  sentencesCorrect: 0,
  scenariosCompleted: 0,
  scenariosTotal: 0,
  lessonsDone: 0,
  lessonsTotal: 0,
  diagnosticDone: false,
  practiceLevel: 1,
};

export interface AchievementDef {
  readonly id: string;
  readonly earned: (s: AchievementStats) => boolean;
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: "first-test", earned: (s) => s.tests >= 1 },
  { id: "diagnostic", earned: (s) => s.diagnosticDone },
  { id: "wpm-20", earned: (s) => s.bestWpm >= 20 },
  { id: "wpm-40", earned: (s) => s.bestWpm >= 40 },
  { id: "wpm-60", earned: (s) => s.bestWpm >= 60 },
  { id: "accuracy-98", earned: (s) => s.bestMinuteAccuracy >= 98 },
  { id: "streak-3", earned: (s) => s.longestStreak >= 3 },
  { id: "streak-7", earned: (s) => s.longestStreak >= 7 },
  { id: "streak-30", earned: (s) => s.longestStreak >= 30 },
  { id: "spelling-50", earned: (s) => s.spellingCorrect >= 50 },
  { id: "sentences-25", earned: (s) => s.sentencesCorrect >= 25 },
  { id: "scenario-first", earned: (s) => s.scenariosCompleted >= 1 },
  { id: "scenario-all", earned: (s) => s.scenariosTotal > 0 && s.scenariosCompleted >= s.scenariosTotal },
  { id: "lessons-all", earned: (s) => s.lessonsTotal > 0 && s.lessonsDone >= s.lessonsTotal },
  { id: "level-5", earned: (s) => s.practiceLevel >= 5 },
];

export function earnedAchievements(s: AchievementStats): string[] {
  return ACHIEVEMENTS.filter((a) => a.earned(s)).map((a) => a.id);
}
