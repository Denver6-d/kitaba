import { describe, expect, it } from "vitest";
import { nextStarGoal, starsFor, starsForTimed } from "@/domain/games/engine";

describe("starsForTimed (Spelling Bee)", () => {
  it("needs 10, 15 and 20 correct words for one, two and three stars at full accuracy", () => {
    expect([9, 10, 14, 15, 19, 20, 40].map((c) => starsForTimed(1, c))).toEqual([0, 1, 1, 2, 2, 3, 3]);
  });
  it("gives nothing for a run-out clock with one perfect word", () => {
    expect(starsForTimed(1, 1)).toBe(0);
    expect(starsForTimed(1, 0)).toBe(0);
  });
  it("is capped by accuracy however many words were correct", () => {
    expect(starsForTimed(0.85, 30)).toBe(2);
    expect(starsForTimed(0.6, 30)).toBe(1);
    expect(starsForTimed(0.59, 30)).toBe(0);
  });
  it("takes the lower of the accuracy and count ratings", () => {
    expect(starsForTimed(0.95, 19)).toBe(2);
    expect(starsForTimed(0.8, 20)).toBe(2);
  });
});

describe("nextStarGoal (stage result: how to earn the next star)", () => {
  it("names the accuracy for the next star, with the boss's lower first star", () => {
    expect(nextStarGoal(0)).toEqual({ star: 1, kind: "accuracy", percent: 60 });
    expect(nextStarGoal(0, { boss: true })).toEqual({ star: 1, kind: "accuracy", percent: 70 });
    expect(nextStarGoal(1)).toEqual({ star: 2, kind: "accuracy", percent: 80 });
    expect(nextStarGoal(2, { boss: true })).toEqual({ star: 3, kind: "accuracy", percent: 95 });
  });
  it("adds the word count in timed rounds", () => {
    expect(nextStarGoal(0, { timed: true })).toEqual({ star: 1, kind: "words", words: 10, percent: 60 });
    expect(nextStarGoal(2, { timed: true })).toEqual({ star: 3, kind: "words", words: 20, percent: 95 });
  });
  it("is null once all three stars are earned", () => {
    expect(nextStarGoal(3)).toBeNull();
  });
  it("agrees with starsFor at every threshold", () => {
    for (const stars of [0, 1, 2]) {
      const g = nextStarGoal(stars);
      expect(g && starsFor(g.percent / 100, 10)).toBe(stars + 1);
      expect(g && starsFor(g.percent / 100 - 0.01, 10)).toBe(stars);
    }
  });
});
