import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, EMPTY_STATS, earnedAchievements, type AchievementStats } from "@/domain/progress/achievements";

const stats = (o: Partial<AchievementStats>): AchievementStats => ({ ...EMPTY_STATS, ...o });

describe("achievements", () => {
  it("have unique ids", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("earns nothing with no activity", () => {
    expect(earnedAchievements(EMPTY_STATS)).toEqual([]);
  });

  it("earns the first-test badge after one test", () => {
    expect(earnedAchievements(stats({ tests: 1 }))).toContain("first-test");
  });

  it("earns speed badges cumulatively", () => {
    const e = earnedAchievements(stats({ tests: 5, bestWpm: 45 }));
    expect(e).toEqual(expect.arrayContaining(["wpm-20", "wpm-40"]));
    expect(e).not.toContain("wpm-60");
  });

  it("requires a full minute test for the accuracy badge", () => {
    expect(earnedAchievements(stats({ bestMinuteAccuracy: 99 }))).toContain("accuracy-98");
    expect(earnedAchievements(stats({ bestMinuteAccuracy: 97 }))).not.toContain("accuracy-98");
  });

  it("earns streak badges from the longest streak", () => {
    expect(earnedAchievements(stats({ longestStreak: 7 }))).toEqual(expect.arrayContaining(["streak-3", "streak-7"]));
  });

  it("covers spelling, sentences, scenarios, lessons and the diagnostic", () => {
    const e = earnedAchievements(
      stats({ spellingCorrect: 50, sentencesCorrect: 25, scenariosCompleted: 8, scenariosTotal: 8, lessonsDone: 6, lessonsTotal: 6, diagnosticDone: true }),
    );
    expect(e).toEqual(
      expect.arrayContaining(["spelling-50", "sentences-25", "scenario-first", "scenario-all", "lessons-all", "diagnostic"]),
    );
  });

  it("does not award 'all' badges when the totals are zero", () => {
    expect(earnedAchievements(stats({ scenariosTotal: 0, lessonsTotal: 0 }))).not.toEqual(expect.arrayContaining(["scenario-all"]));
  });

  it("returns ids in definition order", () => {
    const e = earnedAchievements(stats({ tests: 1, bestWpm: 70, diagnosticDone: true }));
    const order = ACHIEVEMENTS.map((a) => a.id);
    expect([...e].sort((a, b) => order.indexOf(a) - order.indexOf(b))).toEqual(e);
  });
});
