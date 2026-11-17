import { describe, expect, it } from "vitest";
import { applyInput, createEngine, type EngineState } from "@/domain/typing/engine";
import { accuracy, computeMetrics, consistency, netWpm, rawWpm } from "@/domain/typing/metrics";

function typeAt(state: EngineState, text: string, times: number[]): EngineState {
  let s = state;
  [...text].forEach((ch, i) => {
    s = applyInput(s, { kind: "char", char: ch, t: times[i] ?? 0 });
  });
  return s;
}

describe("netWpm / rawWpm", () => {
  it("is correct chars / 5 per minute", () => {
    expect(netWpm(250, 60_000)).toBe(50);
    expect(netWpm(25, 15_000)).toBe(20);
  });
  it("returns 0 for non-positive elapsed time", () => {
    expect(netWpm(10, 0)).toBe(0);
    expect(rawWpm(10, -5)).toBe(0);
  });
  it("rounds to one decimal place", () => {
    expect(netWpm(7, 60_000)).toBe(1.4);
  });
});

describe("accuracy", () => {
  it("is correct / (correct + errors) as a percentage", () => {
    expect(accuracy(9, 1)).toBe(90);
  });
  it("is 100 when nothing was typed", () => {
    expect(accuracy(0, 0)).toBe(100);
  });
});

describe("consistency", () => {
  it("is 100 for perfectly even samples", () => {
    expect(consistency([40, 40, 40, 40])).toBe(100);
  });
  it("drops as samples vary and never goes below 0", () => {
    const c = consistency([10, 60, 10, 60]);
    expect(c).toBeLessThan(60);
    expect(c).toBeGreaterThanOrEqual(0);
    expect(consistency([0, 100, 0, 0, 0, 0])).toBe(0);
  });
  it("is 100 with fewer than two samples", () => {
    expect(consistency([])).toBe(100);
    expect(consistency([33])).toBe(100);
  });
});

describe("computeMetrics", () => {
  it("computes WPM from correct characters in the buffer and the elapsed time", () => {
    // 10 correct chars over 12 seconds → (10/5)/(0.2 min) = 10 wpm
    const s = typeAt(createEngine("abcdefghij"), "abcdefghij", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => i * 1000));
    const m = computeMetrics(s, 12_000);
    expect(m.netWpm).toBe(10);
    expect(m.accuracy).toBe(100);
    expect(m.correctChars).toBe(10);
  });

  it("does not count uncorrected errors toward net WPM but does toward raw WPM", () => {
    const s = typeAt(createEngine("abcde"), "abxde", [0, 100, 200, 300, 400]);
    const m = computeMetrics(s, 60_000);
    expect(m.correctChars).toBe(4);
    expect(m.netWpm).toBe(0.8);
    expect(m.rawWpm).toBe(1);
    expect(m.accuracy).toBe(80);
  });

  it("returns zeros before the test starts", () => {
    const m = computeMetrics(createEngine("abc"), 5000);
    expect(m.netWpm).toBe(0);
    expect(m.elapsedMs).toBe(0);
  });

  it("produces one per-second WPM sample for each full second", () => {
    const s = typeAt(createEngine("aaaaaa"), "aaaaaa", [0, 500, 1000, 1500, 2000, 2500]);
    const m = computeMetrics(s, 3000);
    expect(m.samples).toEqual([24, 24, 24]);
    expect(m.consistency).toBe(100);
  });
});
