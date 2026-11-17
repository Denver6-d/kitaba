import { describe, expect, it } from "vitest";
import {
  BASE_POINTS,
  createGame,
  isAnswered,
  reduceGame,
  remainingMs,
  speedBonusFor,
  summarize,
  type GameItem,
  type GameState,
} from "@/domain/games/engine";
import { checkScore, LEADERBOARD_RULES } from "@/domain/leaderboard/plausibility";

const item = (n: number): GameItem => ({ key: `k${n}`, wordId: `w-${n}`, kind: "typed", mode: "bee", answer: `word${n}` });
const items = (n: number) => Array.from({ length: n }, (_, i) => item(i + 1));
const untimed = { durationMs: null, speedBonus: false };
const bee = { durationMs: 60_000, speedBonus: true };

function play(s: GameState, answers: readonly { correct: boolean; at: number }[]): GameState {
  for (const [i, a] of answers.entries()) {
    s = reduceGame(s, { type: "answer", itemKey: `k${i + 1}`, correct: a.correct, answer: "", t: a.at });
    s = reduceGame(s, { type: "next", t: a.at });
  }
  return s;
}

describe("game engine edges", () => {
  it("gives the speed bonus on its exact boundaries", () => {
    expect([0, 2999, 3000, 4999, 5000, 7999, 8000].map(speedBonusFor)).toEqual([5, 5, 3, 3, 1, 1, 0]);
  });

  it("raises the multiplier at 3, 6 and 10 correct answers in a row", () => {
    const s = play(reduceGame(createGame(items(10), untimed), { type: "start", t: 0 }), Array.from({ length: 10 }, (_, i) => ({ correct: true, at: (i + 1) * 10_000 })));
    const per = s.results.map((r) => r.points);
    expect(per).toEqual([10, 10, 20, 20, 20, 30, 30, 30, 30, 40]);
    expect(s.maxCombo).toBe(10);
  });

  it("keeps the max combo after a miss resets the combo", () => {
    const s = play(reduceGame(createGame(items(5), untimed), { type: "start", t: 0 }), [
      { correct: true, at: 1 },
      { correct: true, at: 2 },
      { correct: true, at: 3 },
      { correct: false, at: 4 },
      { correct: true, at: 5 },
    ]);
    expect(s).toMatchObject({ combo: 1, maxCombo: 3 });
    expect(s.results[3]?.points).toBe(0);
  });

  it("starts the clock on the first answer when no start action came", () => {
    let s = createGame(items(2), untimed);
    s = reduceGame(s, { type: "answer", itemKey: "k1", correct: true, answer: "word1", t: 500 });
    expect(s.startedAt).toBe(500);
    expect(s.results[0]?.ms).toBe(0);
  });

  it("ignores a second start and does not time out before the round starts", () => {
    const s = reduceGame(createGame(items(2), bee), { type: "start", t: 100 });
    expect(reduceGame(s, { type: "start", t: 200 })).toBe(s);
    const idle = createGame(items(2), bee);
    expect(reduceGame(idle, { type: "tick", t: 1e9 })).toBe(idle);
    expect(remainingMs(s, 100 + 60_000 + 5)).toBe(0);
  });

  it("accepts an answer exactly at the buzzer and rejects one a millisecond later", () => {
    const s = reduceGame(createGame(items(2), bee), { type: "start", t: 0 });
    expect(reduceGame(s, { type: "answer", itemKey: "k1", correct: true, answer: "", t: 60_000 }).results).toHaveLength(1);
    expect(reduceGame(s, { type: "answer", itemKey: "k1", correct: true, answer: "", t: 60_001 })).toMatchObject({ finishedAt: 60_000, results: [] });
  });

  it("ignores every action once finished, and an explicit finish ends the game", () => {
    const s = reduceGame(reduceGame(createGame(items(3), untimed), { type: "start", t: 0 }), { type: "finish", t: 50 });
    expect(s.finishedAt).toBe(50);
    expect(reduceGame(s, { type: "answer", itemKey: "k1", correct: true, answer: "", t: 60 })).toBe(s);
    expect(reduceGame(s, { type: "start", t: 60 })).toBe(s);
    expect(isAnswered(s, "k1")).toBe(false);
  });

  it("summarises an unstarted game as zero and lists a missed word once", () => {
    expect(summarize(createGame(items(2), untimed))).toMatchObject({ answered: 0, accuracy: 0, seconds: 0, missed: [] });
    const twice: GameItem[] = [item(1), { ...item(2), wordId: "w-1" }];
    const s = play(reduceGame(createGame(twice, untimed), { type: "start", t: 0 }), [
      { correct: false, at: 1000 },
      { correct: false, at: 2000 },
    ]);
    expect(summarize(s).missed).toEqual(["w-1"]);
  });
});

describe("leaderboard plausibility matches what the engine can produce", () => {
  it("accepts a perfect, fastest-possible timed round", () => {
    const n = 40;
    // One answer per second for 40 seconds, every one correct and fast.
    let s = reduceGame(createGame(items(n), bee), { type: "start", t: 0 });
    s = play(s, Array.from({ length: n }, (_, i) => ({ correct: true, at: (i + 1) * 1000 })));
    const sum = summarize(s);
    expect(sum.points).toBe(s.results.reduce((p, r) => p + r.points, 0));
    expect(sum.points).toBeLessThanOrEqual(sum.correct * LEADERBOARD_RULES.maxPointsPerCorrect);
    expect(checkScore({ points: sum.points, correct: sum.correct, total: sum.answered, durationS: sum.seconds })).toBe("ok");
  });

  it("never awards more per correct answer than the server allows", () => {
    expect(BASE_POINTS * 4 + speedBonusFor(0)).toBe(LEADERBOARD_RULES.maxPointsPerCorrect);
  });
});
