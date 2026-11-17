import Dexie from "dexie";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { createDexieStore, openDb } from "@/repositories/local/db";
import { createDexieOutbox } from "@/repositories/local/outbox";
import { createRepositories } from "@/repositories/create";

/** More Dexie v1 → v2 upgrade cases (the main one lives in contract.test.ts). */

const V1_STORES = {
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
};

async function v1Db(indexedDB: IDBFactory, name: string, fill: (db: Dexie) => Promise<void> = async () => {}) {
  const old = new Dexie(name, { indexedDB, IDBKeyRange });
  old.version(1).stores(V1_STORES);
  await old.open();
  await fill(old);
  old.close();
}

describe("Dexie v1 → v2 upgrade, more cases", () => {
  it("upgrades an empty v1 database into a working v2 one", async () => {
    const indexedDB = new IDBFactory();
    await v1Db(indexedDB, "empty");
    const db = openDb({ indexedDB, IDBKeyRange }, "empty");
    const repos = createRepositories({ store: createDexieStore(db) });
    expect(await repos.profile.get()).toMatchObject({ id: "me", level: null });
    await repos.games.saveSession({ mode: "listen", stageId: "w1-s1", items: 10, correct: 9, points: 90, maxCombo: 5, seconds: 60, at: 1, missed: [] }, 2);
    expect(await repos.games.sessions()).toHaveLength(1);
    expect(db.verno).toBe(2);
    db.close();
  });

  it("migrates pending cloud writes with the same rules as the tables", async () => {
    const indexedDB = new IDBFactory();
    await v1Db(indexedDB, "outbox", async (old) => {
      await old.table("outbox").bulkPut([
        { key: "mastery:spell:w-a", table: "mastery", record: { id: "spell:w-a", updatedAt: 1, mastery: 2 } },
        { key: "mastery:typing:t1", table: "mastery", record: { id: "typing:t1", updatedAt: 1, mastery: 2 } },
        { key: "achievements:wpm-40", table: "achievements", record: { id: "wpm-40", updatedAt: 1, unlockedAt: 1 } },
        { key: "profile:me", table: "profile", record: { id: "me", updatedAt: 1, level: "B2", plan: ["typing"], dailyGoalMinutes: 25 } },
        { key: "keystats:k", table: "keystats", record: { id: "k", updatedAt: 1 } },
      ]);
    });
    const db = openDb({ indexedDB, IDBKeyRange }, "outbox");
    const items = await createDexieOutbox(db).list(100);
    expect(items.map((i) => i.key).sort()).toEqual(["mastery:spell:w-a", "profile:me"]);
    expect(items.find((i) => i.key === "profile:me")?.record).toEqual({ id: "me", updatedAt: 1, level: "B2", dailyGoalMinutes: 25 });
    db.close();
  });

  it("keeps deleted cards deleted and local metadata (shuffle-bags) intact", async () => {
    const indexedDB = new IDBFactory();
    await v1Db(indexedDB, "tomb", async (old) => {
      await old.table("srs").bulkPut([
        { id: "w-a", updatedAt: 2, deletedAt: 3, wordId: "w-a", ease: 2.5, interval: 1, reps: 1, lapses: 0, due: 10, lastReviewed: 1 },
        { id: "w-b", updatedAt: 2, wordId: "w-b", ease: 2.5, interval: 1, reps: 1, lapses: 0, due: 10, lastReviewed: 1 },
      ]);
      await old.table("meta").put({ key: "bag:free:all:all", value: { queue: ["w-b"], recent: [], sig: "1:x" } });
    });
    const db = openDb({ indexedDB, IDBKeyRange }, "tomb");
    const repos = createRepositories({ store: createDexieStore(db) });
    expect((await repos.words.allCards()).map((c) => c.wordId)).toEqual(["w-b"]);
    expect(await repos.words.card("w-a")).toBeUndefined();
    expect(await createDexieOutbox(db).getMeta("bag:free:all:all")).toEqual({ queue: ["w-b"], recent: [], sig: "1:x" });
    db.close();
  });

  it("opens an already-upgraded database again without touching its data", async () => {
    const indexedDB = new IDBFactory();
    await v1Db(indexedDB, "twice", async (old) => {
      await old.table("activity").put({ id: "a1", updatedAt: 3, kind: "typing", at: 3, day: "2026-11-01", seconds: 60, xp: 20 });
    });
    openDb({ indexedDB, IDBKeyRange }, "twice").close();
    const db = openDb({ indexedDB, IDBKeyRange }, "twice");
    const activity = await createRepositories({ store: createDexieStore(db) }).activity.list();
    expect(activity.map((a) => [a.kind, a.xp])).toEqual([["legacy", 20]]);
    db.close();
  });
});
