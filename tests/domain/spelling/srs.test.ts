import { describe, expect, it } from "vitest";
import { applyAnswer, DAY_MS, newCard, qualityFor, review, daysUntil, MIN_EASE } from "@/domain/spelling/srs";

const NOW = Date.UTC(2026, 10, 17, 9);

describe("newCard", () => {
  it("starts with SM-2 defaults and is due immediately", () => {
    expect(newCard("w1", NOW)).toEqual({ wordId: "w1", ease: 2.5, interval: 0, reps: 0, lapses: 0, due: NOW, lastReviewed: 0 });
  });
});

describe("review (SM-2)", () => {
  it("schedules 1 day, then 6 days, then interval × ease for good answers", () => {
    let c = review(newCard("w", NOW), 5, NOW);
    expect(c.interval).toBe(1);
    expect(c.due).toBe(NOW + DAY_MS);
    c = review(c, 5, c.due);
    expect(c.interval).toBe(6);
    const ease = c.ease;
    c = review(c, 5, c.due);
    expect(c.interval).toBe(Math.round(6 * ease));
    expect(c.reps).toBe(3);
  });

  it("raises ease after a perfect answer and lowers it after a hard one", () => {
    expect(review(newCard("w", NOW), 5, NOW).ease).toBeCloseTo(2.6);
    expect(review(newCard("w", NOW), 3, NOW).ease).toBeCloseTo(2.36);
  });

  it("resets repetitions on a failure, counts a lapse and reviews again tomorrow", () => {
    let c = review(review(newCard("w", NOW), 5, NOW), 5, NOW + DAY_MS);
    c = review(c, 1, NOW + 7 * DAY_MS);
    expect(c.reps).toBe(0);
    expect(c.lapses).toBe(1);
    expect(c.interval).toBe(1);
    expect(c.due).toBe(NOW + 8 * DAY_MS);
  });

  it(`never lets ease drop below ${MIN_EASE}`, () => {
    let c = newCard("w", NOW);
    for (let i = 0; i < 20; i += 1) c = review(c, 0, NOW);
    expect(c.ease).toBe(MIN_EASE);
  });

  it("clamps out-of-range quality values", () => {
    expect(review(newCard("w", NOW), 9, NOW).ease).toBeCloseTo(2.6);
    expect(review(newCard("w", NOW), -3, NOW).lapses).toBe(1);
  });

  it("records the review time", () => {
    expect(review(newCard("w", NOW), 4, NOW + 5).lastReviewed).toBe(NOW + 5);
  });
});

describe("qualityFor", () => {
  it("grades a clean correct answer 5", () => {
    expect(qualityFor({ correct: true, revealed: false, answer: "friend", word: "friend" })).toBe(5);
  });
  it("grades a correct answer after revealing the word (no voice available) 4", () => {
    expect(qualityFor({ correct: true, revealed: true, answer: "friend", word: "friend" })).toBe(4);
  });
  it("grades a near miss 2 and a far miss 1", () => {
    expect(qualityFor({ correct: false, revealed: false, answer: "freind", word: "friend" })).toBe(2);
    expect(qualityFor({ correct: false, revealed: false, answer: "xyz", word: "friend" })).toBe(1);
  });
  it("grades an empty answer 0", () => {
    expect(qualityFor({ correct: false, revealed: false, answer: "", word: "friend" })).toBe(0);
  });
});

describe("daysUntil", () => {
  it("rounds up to whole days and never goes below 0", () => {
    expect(daysUntil(NOW + DAY_MS * 1.2, NOW)).toBe(2);
    expect(daysUntil(NOW - 5, NOW)).toBe(0);
  });
});

describe("applyAnswer", () => {
  it("creates a card only for a missed new word", () => {
    expect(applyAnswer(undefined, "w", 5, NOW)).toBeNull();
    expect(applyAnswer(undefined, "w", 1, NOW)?.due).toBe(NOW + DAY_MS);
  });
  it("reviews a due card normally", () => {
    const due = { ...newCard("w", NOW), reps: 2, interval: 6, due: NOW - 1 };
    expect(applyAnswer(due, "w", 5, NOW)?.interval).toBe(15);
  });
  it("does not inflate the interval of a card practised early", () => {
    const early = { ...newCard("w", NOW), reps: 2, interval: 6, due: NOW + 3 * DAY_MS };
    expect(applyAnswer(early, "w", 5, NOW)).toBeNull();
  });
  it("still records a lapse when a card practised early is missed", () => {
    const early = { ...newCard("w", NOW), reps: 2, interval: 6, due: NOW + 3 * DAY_MS };
    expect(applyAnswer(early, "w", 1, NOW)?.lapses).toBe(1);
  });
});
