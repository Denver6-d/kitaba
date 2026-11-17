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
    for (const table of ["mastery", "profile", "results", "ghosts"] as const) {
      for (const r of await local.all(table)) before.set(`${table}:${r.id}`, JSON.stringify(r));
    }
    await fn();
    for (const table of ["mastery", "profile", "results", "ghosts"] as const) {
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
    await a.write(() => a.repos.profile.save({ level: "A2", dailyGoalMinutes: 15 }));
    await a.engine.syncNow();
    expect(await a.outbox.count()).toBe(0);
    await b.engine.syncNow();
    expect((await b.repos.profile.get()).level).toBe("A2");
    expect(a.snapshots.at(-1)).toEqual({ status: "synced", pending: 0 });
  });

  it("resolves a conflict by last write wins on both devices", async () => {
    const { remote } = fakeServer();
    const a = device(remote, "a", 1000);
    const b = device(remote, "b", 9000); // b writes later
    await a.write(() => a.repos.sentences.setMastery("sentence:s-001", 1));
    await b.write(() => b.repos.sentences.setMastery("sentence:s-001", 4));
    await a.engine.syncNow();
    await b.engine.syncNow();
    await a.engine.syncNow();
    expect(await a.repos.sentences.mastery("sentence:s-001")).toBe(4);
    expect(await b.repos.sentences.mastery("sentence:s-001")).toBe(4);
  });

  it("unions append-only records from both devices", async () => {
    const { remote } = fakeServer();
    const a = device(remote, "a", 1000);
    const b = device(remote, "b", 2000);
    const result = { modeKey: "words:30", source: "words" as const, duration: 30, wpm: 30, rawWpm: 31, accuracy: 95, consistency: 80, chars: 75, errors: 1, layoutMismatches: 0, samples: [30], at: 1 };
    await a.write(() => a.repos.progress.saveTestResult(result, { keyStats: {}, target: "t", ghost: [] }));
    await b.write(() => b.repos.progress.saveTestResult({ ...result, wpm: 35 }, { keyStats: {}, target: "t", ghost: [] }));
    await a.engine.syncNow();
    await b.engine.syncNow();
    await a.engine.syncNow();
    expect(await a.repos.progress.listResults()).toHaveLength(2);
    expect(await b.repos.progress.listResults()).toHaveLength(2);
  });

  it("keeps the faster ghost even when the slower one was written later", async () => {
    const { remote } = fakeServer();
    const a = device(remote, "a", 1000);
    const b = device(remote, "b", 9000);
    const result = (wpm: number) => ({ modeKey: "words:30", source: "words" as const, duration: 30, wpm, rawWpm: wpm, accuracy: 95, consistency: 80, chars: 75, errors: 1, layoutMismatches: 0, samples: [wpm], at: 1 });
    await a.write(() => a.repos.progress.saveTestResult(result(50), { keyStats: {}, target: "t", ghost: [[0, 1]] }));
    await b.write(() => b.repos.progress.saveTestResult(result(40), { keyStats: {}, target: "t", ghost: [[0, 1]] }));
    await b.engine.syncNow();
    await a.engine.syncNow(); // a pulls the slower, newer ghost, keeps its own and re-stamps it
    await b.engine.syncNow();
    expect((await a.repos.progress.ghost("words:30"))?.wpm).toBe(50);
    expect((await b.repos.progress.ghost("words:30"))?.wpm).toBe(50);
  });

  it("keeps changes queued while offline and sends them later", async () => {
    const server = fakeServer();
    const a = device(server.remote, "a", 1000);
    server.setOffline(true);
    await a.write(() => a.repos.profile.save({ level: "B1" }));
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
    await a.repos.profile.save({ level: "A1" }); // written before sign-in: not queued
    await a.repos.sentences.setMastery("x", 2);
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
