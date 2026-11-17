import { describe, expect, it } from "vitest";
import { drawFromBag, returnToBag, type BagState } from "@/domain/games/shuffle-bag";
import { seededRng } from "@/domain/shared/random";

const state: BagState = { queue: ["c", "d", "e"], recent: ["x", "a", "b"], sig: "5:abc" };

describe("returnToBag", () => {
  it("returns the same state when nothing is unused", () => {
    expect(returnToBag(state, [])).toBe(state);
  });
  it("puts unused ids at the front in their given order and keeps the signature", () => {
    expect(returnToBag(state, ["b", "a"])).toEqual({ queue: ["b", "a", "c", "d", "e"], recent: ["x"], sig: "5:abc" });
  });
  it("removes duplicates, including ids that were still in the queue", () => {
    const r = returnToBag(state, ["a", "d", "a"]);
    expect(r.queue).toEqual(["a", "d", "c", "e"]);
    expect(r.recent).toEqual(["x", "b"]);
  });
  it("does not mutate the input state", () => {
    const copy = JSON.parse(JSON.stringify(state)) as BagState;
    returnToBag(state, ["a"]);
    expect(state).toEqual(copy);
  });
  it("makes the next draw start with the returned ids", () => {
    const pool = Array.from({ length: 12 }, (_, i) => `w${i}`);
    const first = drawFromBag(pool, null, 6, seededRng(3));
    const spare = first.ids.slice(4);
    const next = drawFromBag(pool, returnToBag(first.state, spare), 2, seededRng(4));
    expect(next.ids).toEqual(spare);
  });
});
