import { describe, expect, it, vi } from "vitest";
import { enterGame, isGameActive, subscribeGameActive } from "@/lib/game-active";

/** The phone's bottom navigation hides while a game session is on screen (DECISIONS M9). */
describe("game-active", () => {
  it("is active while at least one session is on screen, in any mount order", () => {
    expect(isGameActive()).toBe(false);
    const a = enterGame();
    const b = enterGame();
    expect(isGameActive()).toBe(true);
    a();
    expect(isGameActive()).toBe(true);
    b();
    expect(isGameActive()).toBe(false);
  });
  it("leaving twice (a re-run effect cleanup) cannot make it negative", () => {
    const a = enterGame();
    a();
    a();
    const b = enterGame();
    expect(isGameActive()).toBe(true);
    b();
    expect(isGameActive()).toBe(false);
  });
  it("tells subscribers about every change", () => {
    const l = vi.fn();
    const off = subscribeGameActive(l);
    const a = enterGame();
    a();
    off();
    enterGame()();
    expect(l).toHaveBeenCalledTimes(2);
  });
});
