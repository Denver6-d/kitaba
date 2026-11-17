import { describe, expect, it } from "vitest";
import { canonicalJson, decideFirstSync, reconcilePulled, PULL_OVERLAP_MS } from "@/domain/sync/session";
import type { MasteryRecord, StageRecord } from "@/domain/model";

describe("decideFirstSync", () => {
  it("syncs normally when this device is already linked to the account", () => {
    expect(decideFirstSync({ linkedUserId: "u1", userId: "u1", localHasData: true })).toBe("sync");
  });
  it("adopts the account's data when this device has no progress", () => {
    expect(decideFirstSync({ linkedUserId: null, userId: "u1", localHasData: false })).toBe("adopt-remote");
  });
  it("asks before mixing local progress into an account (never silent)", () => {
    expect(decideFirstSync({ linkedUserId: null, userId: "u1", localHasData: true })).toBe("ask");
    expect(decideFirstSync({ linkedUserId: "u2", userId: "u1", localHasData: true })).toBe("ask");
  });
});

describe("reconcilePulled", () => {
  const m = (id: string, updatedAt: number, mastery: number): MasteryRecord => ({ id, updatedAt, mastery });

  it("takes newer remote records locally", () => {
    const r = reconcilePulled("mastery", m("a", 1, 1), m("a", 2, 5));
    expect(r).toEqual({ toLocal: m("a", 2, 5), toRemote: null });
  });
  it("keeps a newer local record and re-sends it", () => {
    const r = reconcilePulled("mastery", m("a", 3, 1), m("a", 2, 5));
    expect(r.toLocal).toBeNull();
    expect(r.toRemote).toEqual(m("a", 3, 1));
  });
  it("does nothing when both sides are identical", () => {
    expect(reconcilePulled("mastery", m("a", 2, 5), m("a", 2, 5))).toEqual({ toLocal: null, toRemote: null });
  });
  it("re-stamps a local winner that is older (special rules) so the server's last-write-wins accepts it", () => {
    const stage = (updatedAt: number, stars: number, clearedAt: number): StageRecord => ({ id: "w1-s1", updatedAt, stars, bestPoints: 10, clearedAt });
    const r = reconcilePulled("stages", stage(1, 3, 100), stage(9, 1, 50));
    // Stored locally with the new stamp too, so both sides end up identical.
    expect(r.toLocal).toEqual(r.toRemote);
    expect(r.toRemote?.stars).toBe(3);
    expect(r.toRemote?.clearedAt).toBe(50);
    expect(r.toRemote?.updatedAt).toBe(10);
  });
  it("stores remote-only records locally", () => {
    expect(reconcilePulled("mastery", undefined, m("b", 1, 1)).toLocal).toEqual(m("b", 1, 1));
  });
  it("overlaps pulls by a few seconds to tolerate out-of-order commits", () => {
    expect(PULL_OVERLAP_MS).toBeGreaterThanOrEqual(1000);
  });
});

describe("canonicalJson", () => {
  it("ignores key order and undefined fields (jsonb reorders keys)", () => {
    expect(canonicalJson({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: undefined } })).toBe(canonicalJson({ a: { d: [1, { x: 1, y: 2 }] }, b: 1 }));
  });
  it("still distinguishes different values and array orders", () => {
    expect(canonicalJson({ a: 1 })).not.toBe(canonicalJson({ a: 2 }));
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
  });
});
