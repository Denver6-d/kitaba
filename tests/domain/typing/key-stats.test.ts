import { describe, expect, it } from "vitest";
import { applyInput, createEngine } from "@/domain/typing/engine";
import {
  errorRate,
  keyStatsFromLog,
  mergeKeyStats,
  weakestKeys,
  weakness,
  type KeyStats,
} from "@/domain/typing/key-stats";
import { buildDrill } from "@/domain/typing/adaptive";
import { ghostPositionAt, recordGhost } from "@/domain/typing/ghost";
import { modeKey, updatePersonalBests, PB_MIN_ACCURACY } from "@/domain/typing/personal-best";
import { seededRng } from "@/domain/shared/random";

describe("keyStatsFromLog", () => {
  it("counts hits and misses per expected key, lower-cased", () => {
    let s = createEngine("Aab");
    for (const [ch, t] of [["A", 0], ["x", 1], ["b", 2]] as const) s = applyInput(s, { kind: "char", char: ch, t });
    const stats = keyStatsFromLog(s.log);
    expect(stats["a"]).toEqual({ hits: 1, misses: 1 });
    expect(stats["b"]).toEqual({ hits: 1, misses: 0 });
  });

  it("ignores corrections and layout mismatches", () => {
    let s = createEngine("ab");
    s = applyInput(s, { kind: "char", char: "ا", code: "KeyH", t: 0 });
    s = applyInput(s, { kind: "char", char: "a", t: 1 });
    s = applyInput(s, { kind: "backspace", t: 2 });
    expect(keyStatsFromLog(s.log)).toEqual({ a: { hits: 1, misses: 0 } });
  });
});

describe("mergeKeyStats", () => {
  it("sums counters key by key", () => {
    const a: KeyStats = { a: { hits: 1, misses: 2 } };
    const b: KeyStats = { a: { hits: 3, misses: 0 }, b: { hits: 1, misses: 1 } };
    expect(mergeKeyStats(a, b)).toEqual({ a: { hits: 4, misses: 2 }, b: { hits: 1, misses: 1 } });
  });
});

describe("weakness and weakestKeys", () => {
  it("is low for unseen keys and grows with misses", () => {
    expect(weakness({ hits: 0, misses: 0 })).toBeLessThan(0.1);
    expect(weakness({ hits: 5, misses: 5 })).toBeGreaterThan(weakness({ hits: 9, misses: 1 }));
  });

  it("errorRate is misses / attempts", () => {
    expect(errorRate({ hits: 3, misses: 1 })).toBe(0.25);
    expect(errorRate({ hits: 0, misses: 0 })).toBe(0);
  });

  it("returns the weakest keys with enough attempts and at least one miss, worst first", () => {
    const stats: KeyStats = {
      e: { hits: 40, misses: 10 },
      q: { hits: 2, misses: 2 }, // too few attempts
      t: { hits: 20, misses: 0 }, // no misses
      r: { hits: 10, misses: 10 },
      " ": { hits: 10, misses: 9 }, // space is not drillable
    };
    expect(weakestKeys(stats, 3)).toEqual(["r", "e"]);
  });
});

describe("buildDrill", () => {
  const pool = ["red rose", "the cat", "rare error", "a dog", "try her", "it is"];

  it("prefers items dense in the weak keys", () => {
    const drill = buildDrill(["r"], pool, 30, seededRng(1));
    expect(drill.length).toBeGreaterThanOrEqual(30);
    const rDensity = [...drill].filter((c) => c === "r").length / drill.length;
    expect(rDensity).toBeGreaterThan(0.15);
  });

  it("is deterministic for the same seed", () => {
    expect(buildDrill(["e"], pool, 40, seededRng(7))).toBe(buildDrill(["e"], pool, 40, seededRng(7)));
  });

  it("still returns practice text when there are no weak keys", () => {
    expect(buildDrill([], pool, 20, seededRng(3)).length).toBeGreaterThanOrEqual(20);
  });

  it("returns an empty string for an empty pool", () => {
    expect(buildDrill(["a"], [], 20, seededRng(3))).toBe("");
  });
});

describe("ghost", () => {
  it("records caret positions over time and replays them", () => {
    let s = createEngine("abcd");
    s = applyInput(s, { kind: "char", char: "a", t: 1000 });
    s = applyInput(s, { kind: "char", char: "b", t: 1500 });
    s = applyInput(s, { kind: "backspace", t: 1700 });
    s = applyInput(s, { kind: "char", char: "b", t: 2000 });
    const ghost = recordGhost(s);
    expect(ghost).toEqual([
      [0, 1],
      [500, 2],
      [700, 1],
      [1000, 2],
    ]);
    expect(ghostPositionAt(ghost, -5)).toBe(0);
    expect(ghostPositionAt(ghost, 0)).toBe(1);
    expect(ghostPositionAt(ghost, 600)).toBe(2);
    expect(ghostPositionAt(ghost, 800)).toBe(1);
    expect(ghostPositionAt(ghost, 99_999)).toBe(2);
  });

  it("downsamples long runs to a bounded number of points", () => {
    let s = createEngine("a".repeat(2000));
    for (let i = 0; i < 2000; i += 1) s = applyInput(s, { kind: "char", char: "a", t: i * 10 });
    const ghost = recordGhost(s, 300);
    expect(ghost.length).toBeLessThanOrEqual(300);
    expect(ghost.at(-1)).toEqual([19_990, 2000]);
  });

  it("returns an empty ghost before the test starts", () => {
    expect(recordGhost(createEngine("abc"))).toEqual([]);
    expect(ghostPositionAt([], 100)).toBe(0);
  });
});

describe("personal bests", () => {
  const result = (wpm: number, accuracy: number) => ({ modeKey: "words:30", wpm, accuracy, at: 1 });

  it("builds a mode key from source and duration", () => {
    expect(modeKey("sentences", 60)).toBe("sentences:60");
  });

  it("records the first qualifying result as a new best", () => {
    const r = updatePersonalBests({}, result(40, 95));
    expect(r.isNew).toBe(true);
    expect(r.bests["words:30"]?.wpm).toBe(40);
  });

  it("only replaces a best with a strictly faster qualifying result", () => {
    const first = updatePersonalBests({}, result(40, 95)).bests;
    expect(updatePersonalBests(first, result(40, 99)).isNew).toBe(false);
    expect(updatePersonalBests(first, result(41, 90)).isNew).toBe(true);
  });

  it(`ignores results below ${PB_MIN_ACCURACY}% accuracy`, () => {
    const r = updatePersonalBests({}, result(80, PB_MIN_ACCURACY - 1));
    expect(r.isNew).toBe(false);
    expect(r.bests).toEqual({});
  });
});
