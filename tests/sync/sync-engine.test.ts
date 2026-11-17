import { sameLevels } from "@/domain/model";
import { describe, expect, it } from "vitest";
import { parseServerTime, SyncEngine, type SyncSnapshot } from "@/features/account/sync-engine";
import { createMemoryOutbox } from "@/repositories/local/outbox";
import { createMemoryStore, type RecordStore } from "@/repositories/store";
import { createRepositories } from "@/repositories/create";
import type { PulledRecord, SupabaseRemote } from "@/repositories/supabase/store";
import type { SyncRecord, TableName } from "@/domain/model";
import { safeNext } from "@/lib/safe-next";

/**
 * In-memory stand-in for the Supabase backend with the same semantics as the
 * SQL: last-write-wins upsert by updatedAt and a server-time pull cursor.
 */
function fakeServer() {
  const rows = new Map<string, { table: TableName; record: SyncRecord; serverAt: number }>();
  let clock = Date.UTC(2026, 0, 1);
  let offline = false;
  const remote: SupabaseRemote = {
    ...createMemoryStore(),
    async upsert(items) {
      if (offline) throw new Error("network");
      for (const { table, record } of items) {
        const key = `${table}:${record.id}`;
        const existing = rows.get(key);
        if (existing && existing.record.updatedAt > record.updatedAt) continue;
        clock += 1;
        rows.set(key, { table, record: structuredClone(record), serverAt: clock });
      }
    },
    async pullSince(since) {
      if (offline) throw new Error("network");
      const t = since ? Date.parse(since) : -Infinity;
      const changed = [...rows.values()].filter((r) => r.serverAt > t).sort((a, b) => a.serverAt - b.serverAt);
      const records: PulledRecord[] = changed.map((r) => ({ table: r.table, record: structuredClone(r.record) }));
      const last = changed.at(-1);
      return { records, cursor: last ? new Date(last.serverAt).toISOString() : since };
    },
  };
  return { remote, rows, setOffline: (v: boolean) => (offline = v) };
}

function device(remote: SupabaseRemote, prefix: string, startTime: number) {
  const local: RecordStore = createMemoryStore();
  const outbox = createMemoryOutbox();
  let t = startTime;
  let id = 0;
  const repos = createRepositories({ store: local, now: () => (t += 10), newId: () => `${prefix}-${(id += 1)}` });
  const snapshots: SyncSnapshot[] = [];
  const engine = new SyncEngine({ userId: "u1", local, remote, outbox, onChange: (s) => snapshots.push(s), onLocalData: () => {} });
  /** Write through repositories and queue the change, as the store observer does in the app. */
  const write = async (fn: () => Promise<unknown>) => {
    const before = new Map<string, string>();
    for (const table of ["mastery", "profile", "sessions", "stages"] as const) {
      for (const r of await local.all(table)) before.set(`${table}:${r.id}`, JSON.stringify(r));
    }
    await fn();
    for (const table of ["mastery", "profile", "sessions", "stages"] as const) {
      const changed = (await local.all(table)).filter((r) => before.get(`${table}:${r.id}`) !== JSON.stringify(r));
      if (changed.length > 0) await outbox.add(table, changed);
    }
  };
  return { local, outbox, repos, engine, snapshots, write };
}

describe("SyncEngine against a fake server", () => {
  it("pushes queued writes and another device pulls them", async () => {
    const { remote } = fakeServer();
    const a = device(remote, "a", 1000);
    const b = device(remote, "b", 5000);
    await a.write(() => a.repos.profile.save({ levels: sameLevels("A2"), levelSource: "choice", dailyGoalMinutes: 15 }));
    await a.engine.syncNow();
    expect(await a.outbox.count()).toBe(0);
    await b.engine.syncNow();
    expect((await b.repos.profile.get()).levels.words).toBe("A2");
    expect(a.snapshots.at(-1)).toEqual({ status: "synced", pending: 0 });
  });

  it("syncs all three learner levels and the latest change wins", async () => {
    const { remote } = fakeServer();
    const a = device(remote, "a", 1000);
    const b = device(remote, "b", 5000);
    await a.write(() => a.repos.profile.save({ levels: { words: "B1", sentences: "A2", tests: "B2" }, levelSource: "placement" }));
    await a.engine.syncNow();
    await b.engine.syncNow();
    expect(await b.repos.profile.get()).toMatchObject({ levels: { words: "B1", sentences: "A2", tests: "B2" }, levelSource: "placement" });
    await b.write(() => b.repos.profile.save({ levels: { words: "C1", sentences: "A2", tests: "B2" } }));
    await b.engine.syncNow();
    await a.engine.syncNow();
    expect((await a.repos.profile.get()).levels.words).toBe("C1");
  });

  it("resolves a conflict by last write wins on both devices", async () => {
    const { remote } = fakeServer();
    const a = device(remote, "a", 1000);
    const b = device(remote, "b", 9000); // b writes later
    await a.write(() => a.repos.mastery.set("spell:w-people", 1));
    await b.write(() => b.repos.mastery.set("spell:w-people", 4));
    await a.engine.syncNow();
    await b.engine.syncNow();
    await a.engine.syncNow();
    expect(await a.repos.mastery.get("spell:w-people")).toBe(4);
    expect(await b.repos.mastery.get("spell:w-people")).toBe(4);
  });

  const session = (points: number) => ({ mode: "listen" as const, stageId: "w1-s1", items: 10, correct: 9, points, maxCombo: 5, seconds: 90, at: 1, missed: [] });

  it("unions append-only records from both devices", async () => {
    const { remote } = fakeServer();
    const a = device(remote, "a", 1000);
    const b = device(remote, "b", 2000);
    await a.write(() => a.repos.games.saveSession({ ...session(100), stageId: null }, 0));
    await b.write(() => b.repos.games.saveSession({ ...session(120), stageId: null }, 0));
    await a.engine.syncNow();
    await b.engine.syncNow();
    await a.engine.syncNow();
    expect(await a.repos.games.sessions()).toHaveLength(2);
    expect(await b.repos.games.sessions()).toHaveLength(2);
  });

  it("keeps the better stage result even when a worse one was written later", async () => {
    const { remote } = fakeServer();
    const a = device(remote, "a", 1000);
    const b = device(remote, "b", 9000);
    await a.write(() => a.repos.games.saveSession(session(150), 3));
    await b.write(() => b.repos.games.saveSession(session(400), 1));
    await b.engine.syncNow();
    await a.engine.syncNow(); // a pulls the worse, newer stage, keeps its own and re-stamps it
    await b.engine.syncNow();
    expect((await a.repos.games.stages())["w1-s1"]?.stars).toBe(3);
    expect((await b.repos.games.stages())["w1-s1"]?.stars).toBe(3);
  });

  it("keeps changes queued while offline and sends them later", async () => {
    const server = fakeServer();
    const a = device(server.remote, "a", 1000);
    server.setOffline(true);
    await a.write(() => a.repos.profile.save({ levels: sameLevels("B1"), levelSource: "choice" }));
    await a.engine.syncNow();
    expect(await a.outbox.count()).toBe(1);
    expect(a.snapshots.at(-1)?.status).toBe("error");
    a.engine.stop(); // cancel the scheduled retry
    server.setOffline(false);
    const again = new SyncEngine({ userId: "u1", local: a.local, remote: server.remote, outbox: a.outbox, onChange: () => {}, onLocalData: () => {} });
    await again.syncNow();
    expect(await a.outbox.count()).toBe(0);
    expect(server.rows.size).toBe(1);
  });

  it("merging local progress into an account uploads everything once", async () => {
    const { remote, rows } = fakeServer();
    const a = device(remote, "a", 1000);
    await a.repos.profile.save({ levels: sameLevels("A1"), levelSource: "choice" }); // written before sign-in: not queued
    await a.repos.mastery.set("x", 2);
    expect(await a.outbox.count()).toBe(0);
    await a.engine.enqueueAllLocal();
    await a.engine.syncNow();
    expect(rows.size).toBe(2);
  });
});

describe("safeNext (open-redirect guard)", () => {
  it("allows same-site paths only", () => {
    expect(safeNext("/account/reset")).toBe("/account/reset");
    expect(safeNext("https://evil.example")).toBe("/account");
    expect(safeNext("//evil.example")).toBe("/account");
    expect(safeNext("/\\evil.example")).toBe("/account");
    expect(safeNext("/javascript:alert(1)")).toBe("/account");
    expect(safeNext(null)).toBe("/account");
  });
  it("rejects control characters the URL parser would strip", () => {
    expect(safeNext("/\t/evil.example")).toBe("/account");
    expect(safeNext("/\n/evil.example")).toBe("/account");
  });
  it("keeps the query and hash of a same-site path", () => {
    expect(safeNext("/test?mode=30#top")).toBe("/test?mode=30#top");
  });
});

describe("parseServerTime", () => {
  it("parses Postgres timestamps with microseconds and +00:00", () => {
    const want = Date.parse("2026-11-17T10:00:00.123Z");
    expect(parseServerTime("2026-11-17T10:00:00.123456+00:00")).toBe(want);
    expect(parseServerTime("2026-11-17T10:00:00.123+00:00")).toBe(want);
  });
  it("returns 0 for garbage so the pull restarts from the beginning", () => {
    expect(parseServerTime("not a date")).toBe(0);
  });
});
