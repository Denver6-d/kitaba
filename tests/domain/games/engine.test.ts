import { describe, expect, it } from "vitest";
import { createGame, currentItem, multiplierFor, reduceGame, remainingMs, speedBonusFor, starsFor, summarize, xpForGame, type GameItem } from "@/domain/games/engine";

const item = (n: number): GameItem => ({ key: `k${n}`, wordId: `w-${n}`, kind: "typed", mode: "listen", answer: `word${n}` });
const items = [item(1), item(2), item(3)];
const untimed = { durationMs: null, speedBonus: false };

describe("game engine", () => {
  it("scores 10 per correct answer with a combo multiplier that resets on a miss", () => {
    expect([1, 2, 3, 5, 6, 9, 10, 20].map(multiplierFor)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
    let s = reduceGame(createGame(items, untimed), { type: "start", t: 0 });
    s = reduceGame(s, { type: "answer", itemKey: "k1", correct: true, answer: "word1", t: 1000 });
    s = reduceGame(s, { type: "next", t: 1100 });
    s = reduceGame(s, { type: "answer", itemKey: "k2", correct: false, answer: "wrd2", t: 2000 });
    expect(s.combo).toBe(0);
    expect(s.points).toBe(10);
    expect(s.results.map((r) => r.ms)).toEqual([1000, 900]);
  });

  it("ignores a second answer to the same item and answers to an item that is not current", () => {
    let s = reduceGame(createGame(items, untimed), { type: "start", t: 0 });
    s = reduceGame(s, { type: "answer", itemKey: "k1", correct: false, answer: "x", t: 1 });
    expect(reduceGame(s, { type: "answer", itemKey: "k1", correct: true, answer: "word1", t: 2 })).toBe(s);
    expect(reduceGame(s, { type: "answer", itemKey: "k3", correct: true, answer: "word3", t: 2 })).toBe(s);
  });

  it("does not move on before the current item is answered, and finishes after the last", () => {
    let s = reduceGame(createGame([item(1)], untimed), { type: "start", t: 0 });
    expect(reduceGame(s, { type: "next", t: 5 })).toBe(s);
    s = reduceGame(s, { type: "answer", itemKey: "k1", correct: true, answer: "word1", t: 10 });
    s = reduceGame(s, { type: "next", t: 20 });
    expect(s.finishedAt).toBe(20);
    expect(currentItem(s)).toBeUndefined();
  });

  it("ends a timed round when time is up and rejects late answers", () => {
    const timed = { durationMs: 60_000, speedBonus: true };
    let s = createGame(items, timed);
    expect(remainingMs(s, 5)).toBe(60_000);
    s = reduceGame(s, { type: "start", t: 1000 });
    s = reduceGame(s, { type: "answer", itemKey: "k1", correct: true, answer: "word1", t: 2000 });
    expect(s.points).toBe(10 + speedBonusFor(1000));
    s = reduceGame(s, { type: "next", t: 2000 });
    const late = reduceGame(s, { type: "answer", itemKey: "k2", correct: true, answer: "word2", t: 62_000 });
    expect(late.finishedAt).toBe(61_000);
    expect(late.results).toHaveLength(1);
    expect(reduceGame(s, { type: "tick", t: 61_000 }).finishedAt).toBe(61_000);
  });

  it("summarises accuracy, missed words, stars and XP", () => {
    let s = reduceGame(createGame(items, untimed), { type: "start", t: 0 });
    for (const [k, ok] of [
      ["k1", true],
      ["k2", false],
      ["k3", true],
    ] as const) {
      s = reduceGame(s, { type: "answer", itemKey: k, correct: ok, answer: "", t: 1000 });
      s = reduceGame(s, { type: "next", t: 2000 });
    }
    const sum = summarize(s);
    expect(sum).toMatchObject({ answered: 3, correct: 2, missed: ["w-2"], seconds: 2 });
    expect(starsFor(sum.accuracy, sum.answered)).toBe(1);
    expect(starsFor(0.65, 10, true)).toBe(0);
    expect([starsFor(0.8, 10), starsFor(0.95, 10), starsFor(1, 0)]).toEqual([2, 3, 0]);
    expect(xpForGame(sum, 1)).toBe(2 * 3 + 1 + 5);
  });
});
