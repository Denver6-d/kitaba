import { describe, expect, it } from "vitest";
import { sameLevels } from "@/domain/model";
import { migrateV1Row, migrateV1Tables, V1_DROPPED_TABLES } from "@/domain/sync/migrate-v1";
import { TABLE_NAMES } from "@/domain/model";

/** The pure v1 → v2 rules shared by the Dexie upgrade and v1 export imports. */

describe("migrateV1Row", () => {
  it("drops every V1-only table", () => {
    for (const t of V1_DROPPED_TABLES) expect(migrateV1Row(t, { id: "x", updatedAt: 1 })).toBeNull();
    expect(migrateV1Row("no-such-table", { id: "x", updatedAt: 1 })).toBeNull();
  });

  it("keeps SRS cards untouched, including tombstones", () => {
    const card = { id: "w-people", updatedAt: 2, deletedAt: 3, wordId: "w-people", ease: 2.5, interval: 1, reps: 1, lapses: 0, due: 10, lastReviewed: 1 };
    expect(migrateV1Row("srs", card)).toBe(card);
  });

  it("keeps only spelling mastery", () => {
    expect(migrateV1Row("mastery", { id: "spell:w-a", updatedAt: 1, mastery: 2 })).not.toBeNull();
    for (const id of ["typing:t1", "sentence:s1", "scenario:x", "spellw-a"]) expect(migrateV1Row("mastery", { id, updatedAt: 1, mastery: 2 })).toBeNull();
    expect(migrateV1Row("mastery", { updatedAt: 1, mastery: 2 })).toBeNull();
  });

  it("keeps all activity for streaks and XP, relabelling removed kinds as legacy", () => {
    for (const kind of ["spelling", "game", "review", "legacy"]) expect(migrateV1Row("activity", { id: "a", kind })).toMatchObject({ kind });
    for (const kind of ["typing", "lesson", "drill", "sentence", undefined]) {
      expect(migrateV1Row("activity", { id: "a", kind, xp: 7, day: "2026-01-01" })).toEqual({ id: "a", kind: "legacy", xp: 7, day: "2026-01-01" });
    }
  });

  it("keeps only achievements that still exist", () => {
    expect(migrateV1Row("achievements", { id: "streak-3", updatedAt: 1, unlockedAt: 1 })).not.toBeNull();
    expect(migrateV1Row("achievements", { id: "wpm-40", updatedAt: 1, unlockedAt: 1 })).toBeNull();
  });

  it("reduces the profile to three levels and the daily goal, with safe defaults", () => {
    expect(migrateV1Row("profile", { id: "me", updatedAt: 5, level: "Z9", plan: ["typing"], diagnosticAt: 1 })).toEqual({
      id: "me",
      updatedAt: 5,
      levels: sameLevels("A2"), levelSource: null, levelsAt: 0,
      dailyGoalMinutes: 10,
    });
    expect(migrateV1Row("profile", { id: "me", updatedAt: 5, level: "C1", dailyGoalMinutes: 30, deletedAt: 6 })).toEqual({
      id: "me",
      updatedAt: 5,
      levels: sameLevels("C1"), levelSource: "choice", levelsAt: 0,
      dailyGoalMinutes: 30,
      deletedAt: 6,
    });
    expect(migrateV1Row("profile", { id: "me", updatedAt: 5, level: "B1", dailyGoalMinutes: "20" })).toMatchObject({ dailyGoalMinutes: 10 });
  });
});

describe("migrateV1Tables", () => {
  it("returns every v2 table, skipping dropped tables, missing tables and non-object rows", () => {
    const out = migrateV1Tables({
      results: [{ id: "r1", updatedAt: 1 }],
      srs: [null, 3, "x", { id: "w-a", updatedAt: 1, wordId: "w-a" }],
      mastery: undefined,
      unknown: [{ id: "u" }],
    });
    expect(Object.keys(out).sort()).toEqual([...TABLE_NAMES].sort());
    expect(out.srs.map((r) => r.id)).toEqual(["w-a"]);
    expect(out.mastery).toEqual([]);
    expect(out.sessions).toEqual([]);
  });

  it("is idempotent: migrating v2-shaped data again changes nothing", () => {
    const once = migrateV1Tables({
      activity: [{ id: "a1", updatedAt: 1, kind: "typing", at: 1, day: "2026-01-01", seconds: 5, xp: 2 }],
      profile: [{ id: "me", updatedAt: 1, level: "A2", dailyGoalMinutes: 15, plan: [] }],
      mastery: [{ id: "spell:w-a", updatedAt: 1, mastery: 1 }],
    });
    expect(migrateV1Tables(once)).toEqual(once);
  });
});
