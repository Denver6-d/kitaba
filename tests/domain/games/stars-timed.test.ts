import { describe, expect, it } from "vitest";
import { starsForTimed } from "@/domain/games/engine";

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
