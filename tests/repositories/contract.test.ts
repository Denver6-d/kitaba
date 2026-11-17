import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { createDexieStore, openDb } from "@/repositories/local/db";
import { createMemoryStore, type RecordStore } from "@/repositories/store";
import { createRepositories } from "@/repositories/create";
import { parseExportFile } from "@/repositories/export";
import type { NewTestResult } from "@/repositories/types";

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
      return createDexieStore(openDb({ indexedDB: new IDBFactory(), IDBKeyRange }, `kitaba-test-${dbCounter}`));
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

const result = (wpm: number, accuracy = 95, modeKey = "words:30"): NewTestResult => ({
  modeKey,
  source: "words",
  duration: 30,
  wpm,
  rawWpm: wpm + 2,
  accuracy,
  consistency: 80,
  chars: wpm * 2.5,
  errors: 1,
  layoutMismatches: 0,
  samples: [wpm],
  at: wpm,
});

describe.each(backends)("repository contract: %s", (_name, makeStore) => {
  it("saves results, reports new personal bests and stores the ghost", async () => {
    const { repos } = setup(makeStore);
    const extras = { keyStats: { a: { hits: 3, misses: 1 } }, target: "abc", ghost: [[0, 1]] as const };

    const first = await repos.progress.saveTestResult(result(30), { ...extras, ghost: [[0, 1]] });
    expect(first.isNewBest).toBe(true);
    expect(first.previousBest).toBeNull();

    const slower = await repos.progress.saveTestResult(result(25), { ...extras, ghost: [[0, 1]] });
    expect(slower.isNewBest).toBe(false);
    expect(slower.previousBest).toBe(30);

    const faster = await repos.progress.saveTestResult(result(40), { ...extras, ghost: [[0, 2]] });
    expect(faster.isNewBest).toBe(true);

    expect((await repos.progress.personalBests())["words:30"]?.wpm).toBe(40);
    expect((await repos.progress.ghost("words:30"))?.wpm).toBe(40);
    expect(await repos.progress.listResults()).toHaveLength(3);
    expect((await repos.progress.keyStats())["a"]).toEqual({ hits: 9, misses: 3 });
  });

  it("does not create a ghost or best for low-accuracy runs", async () => {
    const { repos } = setup(makeStore);
    const r = await repos.progress.saveTestResult(result(90, 50), { keyStats: {}, target: "x", ghost: [[0, 1]] });
    expect(r.isNewBest).toBe(false);
    expect(await repos.progress.ghost("words:30")).toBeUndefined();
  });

  it("logs activity with a day key", async () => {
    const { repos } = setup(makeStore);
    await repos.activity.log("typing", 30.4, 12.6);
    const [a] = await repos.activity.list();
    expect(a).toMatchObject({ kind: "typing", seconds: 30, xp: 13 });
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

  it("tracks sentence attempts and mastery", async () => {
    const { repos } = setup(makeStore);
    await repos.sentences.saveAttempt({ sentenceId: "s1", input: "x", score: 0.5, errors: ["spelling"], at: 1 });
    expect(await repos.sentences.attempts()).toHaveLength(1);
    expect(await repos.sentences.mastery("sentence:s1")).toBe(0);
    await repos.sentences.setMastery("sentence:s1", 2);
    expect(await repos.sentences.mastery("sentence:s1")).toBe(2);
    expect(await repos.sentences.allMastery()).toEqual({ "sentence:s1": 2 });
  });

  it("unlocks achievements once", async () => {
    const { repos } = setup(makeStore);
    expect(await repos.achievements.unlock(["a", "b", "a"])).toEqual(["a", "b"]);
    expect(await repos.achievements.unlock(["b", "c"])).toEqual(["c"]);
    expect((await repos.achievements.list()).map((a) => a.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("returns a default profile and saves patches", async () => {
    const { repos } = setup(makeStore);
    expect((await repos.profile.get()).level).toBeNull();
    await repos.profile.save({ level: "A2", plan: ["spelling"] });
    await repos.profile.save({ dailyGoalMinutes: 15 });
    expect(await repos.profile.get()).toMatchObject({ level: "A2", plan: ["spelling"], dailyGoalMinutes: 15 });
  });

  it("round-trips progress through export → JSON → import (replace)", async () => {
    const a = setup(makeStore);
    await a.repos.progress.saveTestResult(result(33), { keyStats: { e: { hits: 1, misses: 0 } }, target: "t", ghost: [[0, 1]] });
    await a.repos.profile.save({ level: "B1" });
    const json = JSON.stringify(await a.repos.data.exportAll());

    const b = setup(makeStore);
    await b.repos.profile.save({ level: "A1" });
    await b.repos.data.importAll(parseExportFile(json), "replace");
    expect((await b.repos.profile.get()).level).toBe("B1");
    expect(await b.repos.progress.listResults()).toHaveLength(1);
    expect((await b.repos.progress.keyStats())["e"]).toEqual({ hits: 1, misses: 0 });
  });

  it("merges an import using last-write-wins without losing local-only records", async () => {
    const a = setup(makeStore);
    await a.repos.progress.saveTestResult(result(20), { keyStats: {}, target: "t", ghost: [] });
    const file = await a.repos.data.exportAll();

    const b = setup(makeStore, "b");
    await b.repos.progress.saveTestResult(result(21, 95, "sentences:60"), { keyStats: {}, target: "t", ghost: [] });
    await b.repos.profile.save({ level: "A2" });
    await b.repos.data.importAll(file, "merge");
    const modes = (await b.repos.progress.listResults()).map((r) => r.modeKey).sort();
    expect(modes).toEqual(["sentences:60", "words:30"]);
    // b's profile was never in the import, so it survives
    expect((await b.repos.profile.get()).level).toBe("A2");
  });

  it("clears all data", async () => {
    const { repos } = setup(makeStore);
    await repos.profile.save({ level: "A2" });
    await repos.data.clearAll();
    expect((await repos.profile.get()).level).toBeNull();
  });
});

describe("parseExportFile", () => {
  it("rejects invalid JSON and wrong shapes", () => {
    expect(() => parseExportFile("{")).toThrow("invalid-json");
    expect(() => parseExportFile(JSON.stringify({ app: "other" }))).toThrow("invalid-format");
    expect(() => parseExportFile(JSON.stringify({ app: "kitaba", version: 1, exportedAt: 1, tables: { results: [{ id: 5 }] } }))).toThrow(
      "invalid-format",
    );
  });
  it("accepts a minimal valid file and fills missing tables", () => {
    const f = parseExportFile(JSON.stringify({ app: "kitaba", version: 1, exportedAt: 1, tables: {} }));
    expect(f.tables.results).toEqual([]);
  });
});
