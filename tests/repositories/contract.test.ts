import { sameLevels } from "@/domain/model";
import Dexie from "dexie";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { createDexieStore, openDb } from "@/repositories/local/db";
import { createMemoryStore, type RecordStore } from "@/repositories/store";
import { createRepositories } from "@/repositories/create";
import { EXPORT_VERSION, parseExportFile } from "@/repositories/export";
import type { NewSession } from "@/repositories/types";

/**
 * Repository contract: every backend must pass the same suite.
 * The Supabase backend implements the same RecordStore and is verified
 * manually (see supabase/tests/rls_checklist.md); unit tests make no network calls.
 */

let dbCounter = 0;
const backends: Array<[string, () => RecordStore]> = [
  ["memory", () => createMemoryStore()],
  [
    "dexie (fake-indexeddb)",
    () => {
      dbCounter += 1;
      return createDexieStore(openDb({ indexedDB: new IDBFactory(), IDBKeyRange }, `contract-test-${dbCounter}`));
    },
  ],
];

function setup(makeStore: () => RecordStore, prefix = "id") {
  let t = 1_000;
  let id = 0;
  const store = makeStore();
  const repos = createRepositories({
    store,
    now: () => (t += 1000),
    newId: () => `${prefix}-${(id += 1)}`,
  });
  return { repos, store };
}

const session = (over: Partial<NewSession> = {}): NewSession => ({
  mode: "listen",
  stageId: "w1-s1",
  items: 10,
  correct: 8,
  points: 120,
  maxCombo: 4,
  seconds: 95,
  at: 5_000,
  missed: ["w-people", "w-because"],
  ...over,
});

describe.each(backends)("repository contract: %s", (_name, makeStore) => {
  it("saves sessions and keeps the best result per stage (stars, then points)", async () => {
    const { repos } = setup(makeStore);
    const first = await repos.games.saveSession(session(), 2);
    expect(first.previous).toBeNull();
    expect(first.best).toMatchObject({ id: "w1-s1", stars: 2, bestPoints: 120, clearedAt: 5_000 });

    const worse = await repos.games.saveSession(session({ points: 300, at: 9_000 }), 1);
    expect(worse.best).toMatchObject({ stars: 2, bestPoints: 120, clearedAt: 5_000 });

    const morePoints = await repos.games.saveSession(session({ points: 200, at: 10_000 }), 2);
    expect(morePoints.best).toMatchObject({ stars: 2, bestPoints: 200, clearedAt: 5_000 });

    const better = await repos.games.saveSession(session({ points: 90, at: 11_000 }), 3);
    expect(better.best).toMatchObject({ stars: 3, bestPoints: 90, clearedAt: 5_000 });

    expect(await repos.games.sessions()).toHaveLength(4);
    expect((await repos.games.stages())["w1-s1"]?.stars).toBe(3);
  });

  it("does not record a stage for free play, and a zero-star attempt is not a clear", async () => {
    const { repos } = setup(makeStore);
    const free = await repos.games.saveSession(session({ stageId: null }), 0);
    expect(free.best).toBeNull();
    const failed = await repos.games.saveSession(session({ stageId: "w1-s2" }), 0);
    expect(failed.best).toMatchObject({ stars: 0, clearedAt: 0 });
    const cleared = await repos.games.saveSession(session({ stageId: "w1-s2", at: 7_000 }), 1);
    expect(cleared.best).toMatchObject({ stars: 1, clearedAt: 7_000 });
  });

  it("logs activity with a day key", async () => {
    const { repos } = setup(makeStore);
    await repos.activity.log("game", 30.4, 12.6);
    const [a] = await repos.activity.list();
    expect(a).toMatchObject({ kind: "game", seconds: 30, xp: 13 });
    expect(a?.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("stores spelling cards and returns due ones in due order", async () => {
    const { repos } = setup(makeStore);
    const card = (wordId: string, due: number) => ({ wordId, ease: 2.5, interval: 1, reps: 1, lapses: 0, due, lastReviewed: 0 });
    await repos.words.saveCard(card("b", 500));
    await repos.words.saveCard(card("a", 100));
    await repos.words.saveCard(card("c", 9_999_999));
    expect((await repos.words.dueCards(1000)).map((c) => c.wordId)).toEqual(["a", "b"]);
    expect((await repos.words.card("a"))?.due).toBe(100);
    expect(await repos.words.card("zzz")).toBeUndefined();
    expect(await repos.words.allCards()).toHaveLength(3);
  });

  it("tracks mastery", async () => {
    const { repos } = setup(makeStore);
    expect(await repos.mastery.get("spell:w-a")).toBe(0);
    await repos.mastery.set("spell:w-a", 2);
    expect(await repos.mastery.get("spell:w-a")).toBe(2);
    expect(await repos.mastery.all()).toEqual({ "spell:w-a": 2 });
  });

  it("unlocks achievements once", async () => {
    const { repos } = setup(makeStore);
    expect(await repos.achievements.unlock(["a", "b", "a"])).toEqual(["a", "b"]);
    expect(await repos.achievements.unlock(["b", "c"])).toEqual(["c"]);
    expect((await repos.achievements.list()).map((a) => a.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("returns a default profile and saves patches", async () => {
    const { repos } = setup(makeStore);
    expect((await repos.profile.get()).levelSource).toBeNull();
    await repos.profile.save({ levels: sameLevels("B2"), levelSource: "choice" });
    await repos.profile.save({ dailyGoalMinutes: 15 });
    expect(await repos.profile.get()).toMatchObject({ levels: sameLevels("B2"), dailyGoalMinutes: 15 });
  });

  it("round-trips progress through export → JSON → import (replace)", async () => {
    const a = setup(makeStore);
    await a.repos.games.saveSession(session(), 2);
    await a.repos.profile.save({ levels: sameLevels("B1"), levelSource: "choice" });
    const json = JSON.stringify(await a.repos.data.exportAll());

    const b = setup(makeStore);
    await b.repos.profile.save({ levels: sameLevels("A1"), levelSource: "choice" });
    await b.repos.data.importAll(parseExportFile(json), "replace");
    expect((await b.repos.profile.get()).levels.words).toBe("B1");
    expect(await b.repos.games.sessions()).toHaveLength(1);
    expect((await b.repos.games.stages())["w1-s1"]?.stars).toBe(2);
  });

  it("merges an import without losing local-only records, keeping the better stage", async () => {
    const a = setup(makeStore);
    await a.repos.games.saveSession(session({ points: 50 }), 3);
    const file = await a.repos.data.exportAll();

    const b = setup(makeStore, "b");
    await b.repos.games.saveSession(session({ points: 500, stageId: "w1-s1" }), 1);
    await b.repos.profile.save({ levels: sameLevels("A2"), levelSource: "choice" });
    await b.repos.data.importAll(file, "merge");
    expect(await b.repos.games.sessions()).toHaveLength(2);
    expect((await b.repos.games.stages())["w1-s1"]).toMatchObject({ stars: 3, bestPoints: 50 });
    // b's profile was never in the import, so it survives
    expect((await b.repos.profile.get()).levels.words).toBe("A2");
  });

  it("clears all data", async () => {
    const { repos } = setup(makeStore);
    await repos.profile.save({ levels: sameLevels("A2"), levelSource: "choice" });
    await repos.data.clearAll();
    expect((await repos.profile.get()).levelSource).toBeNull();
  });
});

describe("parseExportFile", () => {
  const file = (tables: unknown, version = EXPORT_VERSION) => JSON.stringify({ app: "kitaba", version, exportedAt: 1, tables });

  it("rejects invalid JSON and wrong shapes", () => {
    expect(() => parseExportFile("{")).toThrow("invalid-json");
    expect(() => parseExportFile(JSON.stringify({ app: "other" }))).toThrow("invalid-format");
    expect(() => parseExportFile(file({ sessions: [{ id: 5 }] }))).toThrow("invalid-format");
  });
  it("accepts a minimal valid file and fills missing tables", () => {
    const f = parseExportFile(file({}));
    expect(f.tables.sessions).toEqual([]);
    expect(f.tables.stages).toEqual([]);
  });
  it("rejects rows with missing or mistyped fields", () => {
    expect(() => parseExportFile(file({ stages: [{ id: "w1-s1", updatedAt: 1, stars: 4, bestPoints: 1, clearedAt: 1 }] }))).toThrow("invalid-format");
    expect(() => parseExportFile(file({ sessions: [{ ...session(), id: "s", updatedAt: 1, mode: "typing" }] }))).toThrow("invalid-format");
  });
  it("rejects unknown tables and extra fields", () => {
    expect(() => parseExportFile(file({ secrets: [] }))).toThrow("invalid-format");
    expect(() => parseExportFile(file({ mastery: [{ id: "m", updatedAt: 1, mastery: 1, extra: true }] }))).toThrow("invalid-format");
  });

  it("imports a V1 (pre-pivot) backup, keeping what spelling still needs", () => {
    const v1 = file(
      {
        results: [{ id: "r1", updatedAt: 1, wpm: 40 }],
        keystats: [{ id: "k1", updatedAt: 1, at: 1, stats: {} }],
        srs: [{ id: "w-people", updatedAt: 2, wordId: "w-people", ease: 2.5, interval: 1, reps: 1, lapses: 0, due: 10, lastReviewed: 1 }],
        mastery: [
          { id: "spell:w-people", updatedAt: 2, mastery: 3 },
          { id: "typing:t1", updatedAt: 2, mastery: 1 },
        ],
        activity: [
          { id: "a1", updatedAt: 3, kind: "typing", at: 3, day: "2026-11-01", seconds: 60, xp: 20 },
          { id: "a2", updatedAt: 3, kind: "spelling", at: 3, day: "2026-11-02", seconds: 15, xp: 3 },
        ],
        achievements: [
          { id: "streak-3", updatedAt: 4, unlockedAt: 4 },
          { id: "wpm-40", updatedAt: 4, unlockedAt: 4 },
        ],
        profile: [{ id: "me", updatedAt: 5, level: "A2", plan: ["typing"], dailyGoalMinutes: 15, diagnosticAt: 5 }],
      },
      1,
    );
    const f = parseExportFile(v1);
    expect(f.version).toBe(EXPORT_VERSION);
    expect(f.tables.srs).toHaveLength(1);
    expect(f.tables.mastery.map((m) => m.id)).toEqual(["spell:w-people"]);
    expect(f.tables.activity.map((a) => (a as unknown as { kind: string }).kind)).toEqual(["legacy", "spelling"]);
    expect(f.tables.achievements.map((a) => a.id)).toEqual(["streak-3"]);
    expect(f.tables.profile[0]).toEqual({ id: "me", updatedAt: 5, levels: sameLevels("A2"), levelSource: "choice", levelsAt: 0, dailyGoalMinutes: 15 });
  });
});

describe("Dexie v1 → v2 upgrade (existing learners)", () => {
  it("keeps cards, spelling mastery, streak days, XP, surviving achievements and the goal", async () => {
    const indexedDB = new IDBFactory();
    const name = "upgrade-test";
    // A database as V1 left it.
    const old = new Dexie(name, { indexedDB, IDBKeyRange });
    old.version(1).stores({
      results: "id, at, modeKey, updatedAt",
      keystats: "id, updatedAt",
      ghosts: "id, updatedAt",
      srs: "id, due, updatedAt",
      attempts: "id, sentenceId, at, updatedAt",
      mastery: "id, updatedAt",
      scenarios: "id, scenarioId, at, updatedAt",
      activity: "id, day, at, updatedAt",
      achievements: "id, updatedAt",
      profile: "id, updatedAt",
      outbox: "key",
      meta: "key",
    });
    await old.open();
    await old.table("results").put({ id: "r1", updatedAt: 1, at: 1, modeKey: "words:30" });
    await old.table("srs").put({ id: "w-people", updatedAt: 2, wordId: "w-people", ease: 2.5, interval: 1, reps: 1, lapses: 0, due: 10, lastReviewed: 1 });
    await old.table("mastery").bulkPut([
      { id: "spell:w-people", updatedAt: 2, mastery: 3 },
      { id: "sentence:s1", updatedAt: 2, mastery: 2 },
    ]);
    await old.table("activity").bulkPut([
      { id: "a1", updatedAt: 3, kind: "typing", at: 3, day: "2026-11-01", seconds: 60, xp: 20 },
      { id: "a2", updatedAt: 3, kind: "spelling", at: 3, day: "2026-11-02", seconds: 15, xp: 3 },
    ]);
    await old.table("achievements").bulkPut([
      { id: "streak-7", updatedAt: 4, unlockedAt: 4 },
      { id: "first-test", updatedAt: 4, unlockedAt: 4 },
    ]);
    await old.table("profile").put({ id: "me", updatedAt: 5, level: "B1", plan: ["typing"], dailyGoalMinutes: 20, diagnosticAt: 5 });
    await old.table("outbox").bulkPut([
      { key: "results:r1", table: "results", record: { id: "r1", updatedAt: 1 } },
      { key: "activity:a1", table: "activity", record: { id: "a1", updatedAt: 3, kind: "typing", at: 3, day: "2026-11-01", seconds: 60, xp: 20 } },
    ]);
    old.close();

    const db = openDb({ indexedDB, IDBKeyRange }, name);
    const repos = createRepositories({ store: createDexieStore(db) });
    expect(await repos.words.allCards()).toHaveLength(1);
    expect(await repos.mastery.all()).toEqual({ "spell:w-people": 3 });
    const activity = await repos.activity.list();
    expect(activity.map((a) => [a.day, a.kind, a.xp])).toEqual([
      ["2026-11-01", "legacy", 20],
      ["2026-11-02", "spelling", 3],
    ]);
    expect((await repos.achievements.list()).map((a) => a.id)).toEqual(["streak-7"]);
    expect(await repos.profile.get()).toEqual({ id: "me", updatedAt: 5, levels: sameLevels("B1"), levelSource: "choice", levelsAt: 0, dailyGoalMinutes: 20 });
    expect(db.tables.map((t) => t.name)).not.toContain("results");
    const outbox = await db.outbox.toArray();
    expect(outbox.map((o) => o.key)).toEqual(["activity:a1"]);
    expect((outbox[0]?.record as unknown as { kind: string }).kind).toBe("legacy");
    db.close();
  });
});

describe("atomic replace import", () => {
  it("leaves existing data untouched when the import fails part-way", async () => {
    const store = createMemoryStore();
    const repos = createRepositories({ store });
    await repos.profile.save({ levels: sameLevels("A2"), levelSource: "choice" });
    const failing = { ...store, bulkPut: async () => Promise.reject(new Error("quota")) };
    const broken = createRepositories({ store: failing });
    const exported = await repos.data.exportAll();
    await expect(broken.data.importAll(exported, "replace")).rejects.toThrow("quota");
    expect((await repos.profile.get()).levels.words).toBe("A2");
  });
});

describe("parseExportFile: version 2 files (one level)", () => {
  it("imports a v2 backup and splits its level into three", () => {
    const f = parseExportFile(
      JSON.stringify({ app: "kitaba", version: 2, exportedAt: 1, tables: { profile: [{ id: "me", updatedAt: 5, level: "C1", dailyGoalMinutes: 15 }], srs: [] } }),
    );
    expect(f.version).toBe(3);
    expect(f.tables.profile[0]).toEqual({ id: "me", updatedAt: 5, levels: sameLevels("C1"), levelSource: "choice", levelsAt: 0, dailyGoalMinutes: 15 });
  });

  it("rejects a v3 profile with an invalid level", () => {
    const bad = { id: "me", updatedAt: 5, levels: { words: "D1", sentences: "A1", tests: "A1" }, levelSource: null, levelsAt: 0, dailyGoalMinutes: 15 };
    expect(() => parseExportFile(JSON.stringify({ app: "kitaba", version: 3, exportedAt: 1, tables: { profile: [bad] } }))).toThrow("invalid-format");
  });
});
