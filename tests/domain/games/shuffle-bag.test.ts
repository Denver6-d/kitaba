import { describe, expect, it } from "vitest";
import { drawFromBag, recentGuard, type BagState } from "@/domain/games/shuffle-bag";
import { seededRng } from "@/domain/shared/random";

const pool = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`);

describe("shuffle-bag selection", () => {
  it("never repeats an item until the whole pool has been drawn", () => {
    const rng = seededRng(1);
    const ids = pool(137);
    let state: BagState | null = null;
    const seen: string[] = [];
    while (seen.length < ids.length) {
      const r = drawFromBag(ids, state, 10, rng);
      seen.push(...r.ids);
      state = r.state;
    }
    expect(new Set(seen.slice(0, ids.length)).size).toBe(ids.length);
  });

  it("keeps the most recent items away from the start of the next pass", () => {
    const ids = pool(30);
    const first = drawFromBag(ids, null, 30, seededRng(7));
    const lastDrawn = first.ids.slice(-recentGuard(30));
    for (let seed = 0; seed < 20; seed += 1) {
      const next = drawFromBag(ids, first.state, 5, seededRng(seed));
      for (const id of next.ids) expect(lastDrawn).not.toContain(id);
    }
  });

  it("returns distinct ids even across a refill, and at most the pool size", () => {
    const ids = pool(5);
    const r1 = drawFromBag(ids, null, 3, seededRng(2));
    const r2 = drawFromBag(ids, r1.state, 4, seededRng(3));
    expect(new Set(r2.ids).size).toBe(4);
    expect(drawFromBag(ids, null, 50, seededRng(4)).ids).toHaveLength(5);
  });

  it("starts a new pass when the pool changes, and handles an empty pool", () => {
    const r1 = drawFromBag(pool(10), null, 4, seededRng(5));
    const r2 = drawFromBag(pool(12), r1.state, 12, seededRng(6));
    expect(new Set(r2.ids).size).toBe(12);
    expect(drawFromBag([], null, 3, seededRng(1)).ids).toEqual([]);
  });

  it("survives a JSON round trip (it is stored in local meta)", () => {
    const r1 = drawFromBag(pool(20), null, 7, seededRng(9));
    const restored = JSON.parse(JSON.stringify(r1.state)) as BagState;
    const r2 = drawFromBag(pool(20), restored, 13, seededRng(10));
    expect(new Set([...r1.ids, ...r2.ids]).size).toBe(20);
  });
});
