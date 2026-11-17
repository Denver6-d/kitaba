import { describe, expect, it } from "vitest";
import { addDays, currentStreak, dayKey, longestStreak } from "@/domain/progress/streak";
import { levelInfo } from "@/domain/progress/levels";
import { goalProgress } from "@/domain/progress/goal";
import { hintLevel, nextMastery } from "@/domain/progress/hints";

describe("dayKey / addDays", () => {
  it("formats a local date as YYYY-MM-DD", () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });
});

describe("streaks", () => {
  const days = ["2026-03-01", "2026-03-02", "2026-03-03", "2026-03-05", "2026-03-06"];
  it("counts consecutive days ending today", () => {
    expect(currentStreak(days, "2026-03-06")).toBe(2);
  });
  it("keeps the streak alive if the learner practised yesterday but not yet today", () => {
    expect(currentStreak(days, "2026-03-07")).toBe(2);
  });
  it("breaks after a missed day", () => {
    expect(currentStreak(days, "2026-03-08")).toBe(0);
  });
  it("handles duplicates and order", () => {
    expect(currentStreak(["2026-03-06", "2026-03-05", "2026-03-06"], "2026-03-06")).toBe(2);
  });
  it("finds the longest run", () => {
    expect(longestStreak(days)).toBe(3);
    expect(longestStreak([])).toBe(0);
  });
});

describe("levels", () => {
  it("starts at level 1 with 0 xp", () => {
    expect(levelInfo(0)).toEqual({ level: 1, xpIntoLevel: 0, xpForNext: 100, progress: 0 });
  });
  it("level n starts at 50·n·(n−1) xp", () => {
    expect(levelInfo(100).level).toBe(2);
    expect(levelInfo(299).level).toBe(2);
    expect(levelInfo(300).level).toBe(3);
    expect(levelInfo(150).progress).toBeCloseTo(0.25);
  });
});

describe("goalProgress", () => {
  it("returns minutes done and a clamped ratio", () => {
    expect(goalProgress(300, 10)).toEqual({ minutes: 5, ratio: 0.5, done: false });
    expect(goalProgress(900, 10)).toEqual({ minutes: 15, ratio: 1, done: true });
  });
  it("treats a zero goal as done", () => {
    expect(goalProgress(0, 0).done).toBe(true);
  });
});

describe("hint fading", () => {
  it("shows the full Arabic hint for new items, a partial one while learning, none once mastered", () => {
    expect(hintLevel(0)).toBe("full");
    expect(hintLevel(1)).toBe("partial");
    expect(hintLevel(2)).toBe("partial");
    expect(hintLevel(3)).toBe("none");
  });
  it("raises mastery on success and drops it on failure, never below zero", () => {
    expect(nextMastery(2, true)).toBe(3);
    expect(nextMastery(3, false)).toBe(1);
    expect(nextMastery(0, false)).toBe(0);
  });
});
