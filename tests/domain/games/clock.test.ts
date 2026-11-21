import { describe, expect, it } from "vitest";
import { clockStartFor, startsClockOnInput } from "@/domain/games/clock";
import { createGame, reduceGame, remainingMs } from "@/domain/games/engine";
import type { GameItem } from "@/domain/games/engine";

/** When a timed round's clock starts (DECISIONS M8). */

const timed = { durationMs: 60_000 } as const;
const state = (startedAt: number | null, durationMs: number | null = 60_000, finishedAt: number | null = null) => ({ startedAt, finishedAt, config: { durationMs } }) as Parameters<typeof startsClockOnInput>[0];

describe("clockStartFor", () => {
  it("starts on Start with a mouse, on the first keystroke on a touch device", () => {
    expect(clockStartFor(false)).toBe("on-start");
    expect(clockStartFor(true)).toBe("on-first-key");
  });
});

describe("startsClockOnInput", () => {
  it("starts a timed round that has not started on typing (keydown, change, IME start)", () => {
    for (const t of ["keydown", "change", "compositionstart"]) expect(startsClockOnInput(state(null), t), t).toBe(true);
  });
  it("ignores non-typing events, untimed rounds, a running clock and a finished round", () => {
    expect(startsClockOnInput(state(null), "verdict")).toBe(false);
    expect(startsClockOnInput(state(null), "item")).toBe(false);
    expect(startsClockOnInput(state(null, null), "change")).toBe(false);
    expect(startsClockOnInput(state(1000), "change")).toBe(false);
    expect(startsClockOnInput(state(null, 60_000, 5000), "change")).toBe(false);
  });
});

describe("a round opened before its clock", () => {
  it("keeps the full time until the first keystroke, then counts from that moment", () => {
    const items = [{ key: "a", wordId: "w-a", mode: "bee", kind: "typed", answer: "a" }] as unknown as GameItem[];
    let g = createGame(items, { ...timed } as Parameters<typeof createGame>[1]);
    // Start pressed on a phone at t=0: nothing is dispatched, so the clock still shows the full round 9 s later.
    expect(remainingMs(g, 9_000)).toBe(60_000);
    // First keystroke at t=9 s starts it.
    expect(startsClockOnInput(g, "change")).toBe(true);
    g = reduceGame(g, { type: "start", t: 9_000 });
    expect(remainingMs(g, 19_000)).toBe(50_000);
    expect(startsClockOnInput(g, "change")).toBe(false);
  });
});

describe("GameSession wiring", () => {
  it("opens the round without the clock on touch, and starts the clock from the input handler", async () => {
    const { readFileSync } = await import("node:fs");
    const s = readFileSync(new URL("../../../src/features/games/game-session.tsx", import.meta.url), "utf8");
    expect(s).toMatch(/if \(clockStartFor\(touch\) === "on-first-key"\) setOpenedBeforeClock\(true\);\s*else dispatch\(\{ type: "start"/);
    expect(s).toMatch(/if \(startsClockOnInput\(game, ev\.type\)\) dispatch\(\{ type: "start"/);
    expect(s).toMatch(/const notStarted = !roundOpen;/);
  });
});
