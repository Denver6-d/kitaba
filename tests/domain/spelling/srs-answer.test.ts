import { describe, expect, it } from "vitest";
import { applyAnswer, DAY_MS, newCard, qualityFor, review } from "@/domain/spelling/srs";
import { charDistance } from "@/domain/spelling/diff";

/** What one answer does to a word's schedule: qualityFor (letter distance) feeding applyAnswer. */

const NOW = Date.UTC(2026, 10, 17, 9);
const miss = (answer: string, word: string) => qualityFor({ correct: false, revealed: false, answer, word });

describe("qualityFor uses the letter distance from the diff module", () => {
  it("treats up to two letter edits as a near miss and three as a far miss", () => {
    expect(charDistance("acomodate", "accommodate")).toBe(2);
    expect(miss("acomodate", "accommodate")).toBe(2);
    expect(charDistance("acomodat", "accommodate")).toBe(3);
    expect(miss("acomodat", "accommodate")).toBe(1);
  });

  it("ignores case and surrounding spaces in the answer", () => {
    expect(miss("  FREIND ", "friend")).toBe(2);
  });

  it("treats a whitespace-only answer like 'I don't know'", () => {
    expect(miss("   ", "friend")).toBe(0);
  });

  it("measures against the spelling the learner was asked for (UK variant)", () => {
    // "color" is one edit from "colour": a near miss for a UK learner.
    expect(miss("color", "colour")).toBe(2);
    expect(miss("clr", "colour")).toBe(1);
  });

  it("grades a right spelling marked wrong (e.g. Fix the Mistake with the wrong token picked) as a near miss", () => {
    expect(miss("receive", "receive")).toBe(2);
  });
});

describe("applyAnswer with real quality scores", () => {
  it("creates a card due tomorrow for a missed new word, with the ease each miss deserves", () => {
    const near = applyAnswer(undefined, "w", miss("freind", "friend"), NOW);
    const far = applyAnswer(undefined, "w", miss("xyz", "friend"), NOW);
    const blank = applyAnswer(undefined, "w", miss("", "friend"), NOW);
    expect(near).toMatchObject({ wordId: "w", reps: 0, lapses: 1, interval: 1, due: NOW + DAY_MS, lastReviewed: NOW });
    expect([near?.ease, far?.ease, blank?.ease]).toEqual([2.18, 1.96, 1.7]);
  });

  it("does not create a card for a word answered correctly, even after revealing it", () => {
    expect(applyAnswer(undefined, "w", qualityFor({ correct: true, revealed: true, answer: "x", word: "x" }), NOW)).toBeNull();
  });

  it("reviews a card that is due exactly now", () => {
    const card = { ...newCard("w", NOW - 6 * DAY_MS), reps: 1, interval: 1, due: NOW };
    expect(applyAnswer(card, "w", 5, NOW)).toMatchObject({ reps: 2, interval: 6, due: NOW + 6 * DAY_MS });
  });

  it("keeps the ease of a due card answered correctly after revealing (no voice on the device)", () => {
    const card = { ...newCard("w", NOW), reps: 2, interval: 6, due: NOW - 1 };
    const q = qualityFor({ correct: true, revealed: true, answer: "friend", word: "friend" });
    expect(applyAnswer(card, "w", q, NOW)?.ease).toBe(2.5);
  });

  it("restarts an early-practised card that is missed, keeping its lapse history", () => {
    const early = { ...review(review(newCard("w", NOW), 5, NOW), 5, NOW + DAY_MS), lapses: 2 };
    const next = applyAnswer(early, "w", miss("freind", "friend"), NOW + 2 * DAY_MS);
    expect(next).toMatchObject({ reps: 0, interval: 1, lapses: 3, due: NOW + 3 * DAY_MS });
  });
});
