import { describe, expect, it } from "vitest";
import { ACHIEVEMENT_IDS, ACHIEVEMENTS, EMPTY_STATS, earnedAchievements, type AchievementStats } from "@/domain/progress/achievements";
import { ACHIEVEMENT_TEXT } from "@/features/rewards/achievement-text";

const stats = (o: Partial<AchievementStats>): AchievementStats => ({ ...EMPTY_STATS, ...o });

describe("achievements", () => {
  it("have unique ids and text in both languages", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(ACHIEVEMENT_TEXT[id]?.ar.title, id).toBeTruthy();
      expect(ACHIEVEMENT_TEXT[id]?.en.title, id).toBeTruthy();
    }
    expect(Object.keys(ACHIEVEMENT_TEXT).sort()).toEqual([...ids].sort());
  });

  it("earns nothing with no activity", () => {
    expect(earnedAchievements(EMPTY_STATS)).toEqual([]);
  });

  it("earns the first badge after one game", () => {
    expect(earnedAchievements(stats({ games: 1 }))).toContain("first-game");
  });

  it("earns word-count badges cumulatively", () => {
    const e = earnedAchievements(stats({ correctWords: 300 }));
    expect(e).toEqual(expect.arrayContaining(["spelling-50", "words-250"]));
    expect(e).not.toContain("words-1000");
  });

  it("needs every boss for the all-worlds badge", () => {
    expect(earnedAchievements(stats({ bossesCleared: 7 }))).not.toContain("all-bosses");
    expect(earnedAchievements(stats({ bossesCleared: 8 }))).toEqual(expect.arrayContaining(["first-boss", "all-bosses"]));
  });

  it("keeps the V1 ids that still mean the same thing, so old unlocks survive the migration", () => {
    for (const id of ["spelling-50", "streak-3", "streak-7", "streak-30", "level-5"]) expect(ACHIEVEMENT_IDS.has(id)).toBe(true);
    for (const id of ["first-test", "wpm-20", "sentences-25", "scenario-all", "lessons-all", "diagnostic"]) expect(ACHIEVEMENT_IDS.has(id)).toBe(false);
  });

  it("earns streak, combo, daily, review and level badges at their thresholds", () => {
    const e = earnedAchievements(stats({ longestStreak: 7, bestCombo: 10, dailyDone: 7, reviewsDone: 50, practiceLevel: 10, perfectStages: 1, totalStars: 60 }));
    expect(e).toEqual(expect.arrayContaining(["streak-3", "streak-7", "combo-10", "daily-7", "review-50", "level-5", "level-10", "perfect-stage", "stars-60"]));
    expect(e).not.toContain("streak-30");
  });
});
