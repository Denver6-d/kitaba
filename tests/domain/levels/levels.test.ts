import { describe, expect, it } from "vitest";
import { levelsByDistance, poolAtLevel } from "@/domain/levels/pool";
import {
  answerPlacement,
  pickPlacementWord,
  PLACEMENT_ITEMS,
  placementDone,
  placementLevel,
  placementResult,
  startPlacement,
  type PlacementState,
} from "@/domain/levels/placement";
import { LEVELS, sameLevels, type CefrLevel } from "@/domain/model";
import { migrateProfileRow } from "@/domain/sync/migrate-profile";
import { seededRng } from "@/domain/shared/random";
import { spellingWords } from "@/data/words";

describe("levelsByDistance", () => {
  it("starts at the level, then alternates below and above", () => {
    expect(levelsByDistance("B1")).toEqual(["B1", "A2", "B2", "A1", "C1"]);
    expect(levelsByDistance("A1")).toEqual(["A1", "A2", "B1", "B2", "C1"]);
    expect(levelsByDistance("C1")).toEqual(["C1", "B2", "B1", "A2", "A1"]);
  });
});

describe("poolAtLevel", () => {
  const words = [
    { id: "a", level: "A1" as CefrLevel },
    { id: "b", level: "B1" as CefrLevel },
    { id: "c", level: "B1" as CefrLevel },
    { id: "d", level: "B2" as CefrLevel },
    { id: "e", level: "A2" as CefrLevel },
  ];
  it("keeps only the level when it has enough words", () => {
    expect(poolAtLevel(words, "B1", 2)).toEqual({ pool: [words[1], words[2]], levels: ["B1"] });
  });
  it("widens to the nearest levels, easier first, only as far as needed", () => {
    expect(poolAtLevel(words, "B1", 3).levels).toEqual(["B1", "A2"]);
    expect(poolAtLevel(words, "B1", 4).levels).toEqual(["B1", "A2", "B2"]);
    expect(poolAtLevel(words, "B1", 99).pool).toHaveLength(5);
  });
});

/** Answers every item with `isRight(level)` and returns the final state. */
function run(isRight: (level: CefrLevel) => boolean): PlacementState {
  let s = startPlacement();
  let i = 0;
  while (!placementDone(s)) {
    const level = placementLevel(s);
    s = answerPlacement(s, { wordId: `w${i++}`, level, correct: isRight(level) });
  }
  return s;
}

const rank = (l: CefrLevel) => LEVELS.indexOf(l);

describe("placement test", () => {
  it("starts at A2 and asks 16 items (15–20 required)", () => {
    expect(placementLevel(startPlacement())).toBe("A2");
    expect(PLACEMENT_ITEMS).toBeGreaterThanOrEqual(15);
    expect(PLACEMENT_ITEMS).toBeLessThanOrEqual(20);
    expect(run(() => true).answers).toHaveLength(PLACEMENT_ITEMS);
  });

  it("goes up after a correct answer and down after a wrong one", () => {
    const s0 = startPlacement();
    expect(placementLevel(answerPlacement(s0, { wordId: "x", level: "A2", correct: true }))).toBe("B1");
    expect(placementLevel(answerPlacement(s0, { wordId: "x", level: "A2", correct: false }))).toBe("A1");
  });

  it("halves the step on a change of direction, never below half a level", () => {
    let s = startPlacement();
    s = answerPlacement(s, { wordId: "1", level: "A2", correct: true });
    s = answerPlacement(s, { wordId: "2", level: "B1", correct: false });
    expect(s.step).toBe(0.5);
    s = answerPlacement(s, { wordId: "3", level: "A2", correct: true });
    expect(s.step).toBe(0.5);
  });

  it("places a learner who knows everything at C1 and one who knows nothing at A1", () => {
    expect(placementResult(run(() => true)).level).toBe("C1");
    expect(placementResult(run(() => false)).level).toBe("A1");
  });

  it("finds the learner's true level for every level", () => {
    for (const truth of LEVELS) {
      const result = placementResult(run((l) => rank(l) <= rank(truth)));
      expect(result.level, truth).toBe(truth);
    }
  });

  it("explains the result with the tallies at the level and the one above", () => {
    const r = placementResult(run((l) => rank(l) <= rank("B1")));
    expect(r.at).toMatchObject({ level: "B1" });
    expect(r.at?.correct).toBe(r.at?.total);
    expect(r.above).toMatchObject({ level: "B2", correct: 0 });
    expect(placementResult(run(() => true)).above).toBeNull();
  });

  it("ignores answers after the end", () => {
    const done = run(() => true);
    expect(answerPlacement(done, { wordId: "z", level: "A1", correct: false })).toBe(done);
  });

  it("picks unused words at the level, falling back to the nearest level", () => {
    const rng = seededRng(1);
    const words = spellingWords.filter((w) => w.level === "C1").slice(0, 2);
    const used = new Set<string>();
    const a = pickPlacementWord(words, "C1", used, rng);
    expect(a?.level).toBe("C1");
    used.add(a?.id ?? "");
    const b = pickPlacementWord(words, "C1", used, rng);
    expect(b?.id).not.toBe(a?.id);
    used.add(b?.id ?? "");
    expect(pickPlacementWord(words, "C1", used, rng)).toBeNull();
    const mixed = [...words, ...spellingWords.filter((w) => w.level === "B2").slice(0, 1)];
    expect(pickPlacementWord(mixed, "C1", used, rng)?.level).toBe("B2");
  });
});

describe("migrateProfileRow (v2 → v3)", () => {
  it("spreads an old level to all three and marks it as chosen", () => {
    expect(migrateProfileRow({ id: "me", updatedAt: 3, level: "B2", dailyGoalMinutes: 20 })).toEqual({
      id: "me",
      updatedAt: 3,
      levels: sameLevels("B2"),
      levelSource: "choice",
      levelsAt: 0,
      dailyGoalMinutes: 20,
    });
  });
  it("defaults to A2 with no source (first visit) when no level was stored", () => {
    expect(migrateProfileRow({ id: "me", updatedAt: 3, level: null, dailyGoalMinutes: 10 })).toMatchObject({ levels: sameLevels("A2"), levelSource: null });
  });
  it("is idempotent and repairs bad values", () => {
    const v3 = { id: "me", updatedAt: 3, levels: { words: "C1", sentences: "B1", tests: "A1" }, levelSource: "placement", levelsAt: 9, dailyGoalMinutes: 10 };
    expect(migrateProfileRow(v3)).toEqual(v3);
    expect(migrateProfileRow(migrateProfileRow(v3))).toEqual(v3);
    // No valid level stored: treated as never set, so the welcome screen shows.
    expect(migrateProfileRow({ ...v3, levels: { words: "Z9" }, levelSource: "hack", levelsAt: -1 })).toMatchObject({
      levels: { words: "A2", sentences: "A2", tests: "A2" },
      levelSource: null,
      levelsAt: 0,
    });
  });
  it("keeps a tombstone", () => {
    expect(migrateProfileRow({ id: "me", updatedAt: 3, deletedAt: 4 })).toMatchObject({ deletedAt: 4 });
  });
});

describe("placement robustness", () => {
  it("places a learner guessing among four options (25%) at A1 almost always", () => {
    const rng = seededRng(42);
    let a1 = 0;
    const runs = 500;
    for (let r = 0; r < runs; r += 1) {
      if (placementResult(run(() => rng() < 0.25)).level === "A1") a1 += 1;
    }
    expect(a1 / runs).toBeGreaterThanOrEqual(0.9);
  });
});
