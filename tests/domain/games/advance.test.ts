import { describe, expect, it } from "vitest";
import { carriesIntoNext, SETTLE_MS, tapTooSoon, typingAdvances } from "@/domain/games/advance";
import { initialAnswerInput, reduceAnswerInput, type AnswerInputEvent } from "@/domain/spelling/answer-input";

/** Moving on after an answer on touch devices (DECISIONS M9). */

describe("typingAdvances", () => {
  it("keeps 'start typing to continue' with a keyboard", () => {
    expect(typingAdvances(false, true)).toBe(true);
    expect(typingAdvances(false, false)).toBe(false);
  });
  it("never advances from typing on a touch device", () => {
    expect(typingAdvances(true, true)).toBe(false);
    expect(typingAdvances(true, false)).toBe(false);
  });
});

describe("carriesIntoNext", () => {
  it("carries letters typed during feedback only with a keyboard", () => {
    expect(carriesIntoNext(false)).toBe(true);
    expect(carriesIntoNext(true)).toBe(false);
  });
});

describe("tapTooSoon", () => {
  const base = { touch: true, keyboard: false, changedAt: 1000 };
  it("ignores a tap that begins within the settle time after the bar changed", () => {
    expect(tapTooSoon({ ...base, pressedAt: 1000 })).toBe(true);
    expect(tapTooSoon({ ...base, pressedAt: 1000 + 120 })).toBe(true); // the second half of a double tap
    expect(tapTooSoon({ ...base, pressedAt: 1000 + SETTLE_MS - 1 })).toBe(true);
  });
  it("accepts a deliberate tap after the settle time", () => {
    expect(tapTooSoon({ ...base, pressedAt: 1000 + SETTLE_MS })).toBe(false);
    expect(tapTooSoon({ ...base, pressedAt: 5000 })).toBe(false);
  });
  it("never ignores keyboard activation, a mouse, a bar that never changed, or a press from before the change", () => {
    expect(tapTooSoon({ ...base, keyboard: true, pressedAt: 1010 })).toBe(false);
    expect(tapTooSoon({ ...base, touch: false, pressedAt: 1010 })).toBe(false);
    expect(tapTooSoon({ ...base, changedAt: null, pressedAt: 1010 })).toBe(false);
    expect(tapTooSoon({ ...base, pressedAt: 900 })).toBe(false);
  });
  it("is longer than Android's double-tap window and short enough to go unnoticed", () => {
    expect(SETTLE_MS).toBeGreaterThan(300);
    expect(SETTLE_MS).toBeLessThanOrEqual(600);
  });
});

describe("the Android sequences from the phone test", () => {
  const run = (events: AnswerInputEvent[]) => events.reduce(reduceAnswerInput, initialAnswerInput("w1"));

  it("a keyboard re-committing its composing word after the verdict asks to advance (the bug), which touch ignores", () => {
    // Composing "qzx", Check (the verdict empties the field), then the keyboard commits "qzx" again.
    const s = run([
      { type: "compositionstart" },
      { type: "change", value: "qzx", t: 10 },
      { type: "verdict" },
      { type: "compositionend", value: "qzx", t: 20 },
    ]);
    expect(s.phase).toBe("feedback");
    expect(s.advanceRequested).toBe(true); // what used to skip the result
    expect(typingAdvances(true, s.advanceRequested)).toBe(false);
    expect(typingAdvances(false, s.advanceRequested)).toBe(true); // desktop keeps the shortcut
  });

  it("a suggestion-bar tap after the verdict asks to advance, which touch ignores", () => {
    const s = run([{ type: "change", value: "qzx", t: 10 }, { type: "verdict" }, { type: "change", value: "the ", t: 30 }]);
    expect(s.advanceRequested).toBe(true);
    expect(typingAdvances(true, s.advanceRequested)).toBe(false);
  });

  it("on touch nothing typed during feedback reaches the next word", () => {
    const s = run([{ type: "change", value: "qzx", t: 10 }, { type: "verdict" }, { type: "change", value: "a", t: 30 }]);
    const event: AnswerInputEvent = carriesIntoNext(true) ? { type: "item", itemKey: "w2", t: 40 } : { type: "item", itemKey: "w2", carry: "", t: 40 };
    const next = reduceAnswerInput(s, event);
    expect(next.value).toBe("");
    expect(next.startedAt).toBeNull();
  });

  it("the first character of the next word is still kept (B1)", () => {
    const s = run([{ type: "change", value: "qzx", t: 10 }, { type: "verdict" }, { type: "item", itemKey: "w2", carry: "", t: 40 }, { type: "change", value: "h", t: 50 }]);
    expect(s.value).toBe("h");
    expect(s.startedAt).toBe(50);
  });
});
