import { describe, expect, it } from "vitest";
import { mergeRecord, mergeTable } from "@/domain/sync/merge";
import { enqueue, nextRetryDelay, removeAcked, type OutboxItem } from "@/domain/sync/outbox";
import type { AchievementRecord, GhostRecord, MasteryRecord } from "@/domain/model";

const m = (id: string, updatedAt: number, mastery: number, deletedAt?: number): MasteryRecord =>
  deletedAt === undefined ? { id, updatedAt, mastery } : { id, updatedAt, mastery, deletedAt };

describe("mergeRecord (last-write-wins per record)", () => {
  it("keeps the side that was written last", () => {
    expect(mergeRecord("mastery", m("a", 1, 1), m("a", 2, 5))).toEqual(m("a", 2, 5));
    expect(mergeRecord("mastery", m("a", 3, 1), m("a", 2, 5))).toEqual(m("a", 3, 1));
  });
  it("prefers the remote copy on an exact tie (deterministic)", () => {
    expect(mergeRecord("mastery", m("a", 2, 1), m("a", 2, 9))).toEqual(m("a", 2, 9));
  });
  it("returns whichever side exists", () => {
    expect(mergeRecord("mastery", undefined, m("a", 1, 1))).toEqual(m("a", 1, 1));
    expect(mergeRecord("mastery", m("a", 1, 1), undefined)).toEqual(m("a", 1, 1));
  });
  it("lets a newer tombstone win, and a newer edit resurrect", () => {
    expect(mergeRecord("mastery", m("a", 1, 1), m("a", 2, 1, 2))?.deletedAt).toBe(2);
    expect(mergeRecord("mastery", m("a", 3, 4), m("a", 2, 1, 2))?.deletedAt).toBeUndefined();
  });

  it("keeps the faster ghost regardless of time", () => {
    const g = (updatedAt: number, wpm: number): GhostRecord => ({
      id: "words:30",
      updatedAt,
      modeKey: "words:30",
      wpm,
      target: "x",
      ghost: [],
    });
    expect(mergeRecord("ghosts", g(1, 50), g(9, 40))?.wpm).toBe(50);
    expect(mergeRecord("ghosts", g(9, 40), g(1, 50))?.wpm).toBe(50);
  });

  it("keeps the earliest unlock time for achievements", () => {
    const a = (updatedAt: number, unlockedAt: number): AchievementRecord => ({ id: "first-test", updatedAt, unlockedAt });
    expect(mergeRecord("achievements", a(5, 5), a(3, 3))?.unlockedAt).toBe(3);
  });
});

describe("mergeTable", () => {
  it("computes what each side is missing or has stale", () => {
    const local = [m("a", 1, 1), m("b", 5, 5), m("c", 1, 1)];
    const remote = [m("a", 2, 2), m("b", 4, 4), m("d", 1, 1)];
    const r = mergeTable("mastery", local, remote);
    expect(r.toLocal.map((x) => x.id).sort()).toEqual(["a", "d"]);
    expect(r.toRemote.map((x) => x.id).sort()).toEqual(["b", "c"]);
    expect(r.merged.map((x) => `${x.id}:${x.mastery}`).sort()).toEqual(["a:2", "b:5", "c:1", "d:1"]);
  });
  it("is a no-op when both sides are identical", () => {
    const both = [m("a", 1, 1)];
    const r = mergeTable("mastery", both, both);
    expect(r.toLocal).toEqual([]);
    expect(r.toRemote).toEqual([]);
  });
  it("never loses append-only records from either side", () => {
    const r = mergeTable("mastery", [m("x", 1, 1)], [m("y", 1, 1)]);
    expect(r.merged).toHaveLength(2);
  });
});

describe("outbox", () => {
  const item = (id: string, updatedAt: number): OutboxItem => ({ key: `mastery:${id}`, table: "mastery", record: m(id, updatedAt, 1) });

  it("deduplicates by table+id keeping the newest record", () => {
    const q = enqueue(enqueue([item("a", 1)], item("a", 2)), item("b", 1));
    expect(q).toHaveLength(2);
    expect(q.find((i) => i.key === "mastery:a")?.record.updatedAt).toBe(2);
  });
  it("does not replace a newer queued record with an older one", () => {
    const q = enqueue([item("a", 5)], item("a", 2));
    expect(q[0]?.record.updatedAt).toBe(5);
  });
  it("removes acknowledged items only if they were not updated meanwhile", () => {
    const q = [item("a", 2), item("b", 1)];
    const acked = [item("a", 1), item("b", 1)];
    expect(removeAcked(q, acked).map((i) => i.key)).toEqual(["mastery:a"]);
  });
  it("backs off exponentially up to a minute", () => {
    expect(nextRetryDelay(0)).toBe(1000);
    expect(nextRetryDelay(3)).toBe(8000);
    expect(nextRetryDelay(20)).toBe(60_000);
  });
});
