import { describe, expect, it } from "vitest";
import {
  displayValue,
  initialAnswerInput,
  MAX_ANSWER_LENGTH,
  reduceAnswerInput,
  type AnswerInputEvent,
  type AnswerInputState,
} from "@/domain/spelling/answer-input";

const run = (events: readonly AnswerInputEvent[], start: AnswerInputState = initialAnswerInput("w1")) =>
  events.reduce(reduceAnswerInput, start);

/** Regression suite for the "first character is lost" bug (DECISIONS B1). */
describe("answer input keeps the first character", () => {
  it("stores the first character and starts the clock in the same update", () => {
    const s = run([
      { type: "keydown", t: 100 },
      { type: "change", value: "r", t: 101 },
    ]);
    expect(s.value).toBe("r");
    expect(s.startedAt).toBe(101);
  });

  it("does not react to keydown, so a re-render triggered by it cannot lose input", () => {
    const before = initialAnswerInput("w1");
    expect(reduceAnswerInput(before, { type: "keydown", t: 1 })).toBe(before);
  });

  it("ignores a repeated item event for the current item (an effect re-run must not wipe the value)", () => {
    const s = run([
      { type: "change", value: "r", t: 1 },
      { type: "item", itemKey: "w1" },
    ]);
    expect(s.value).toBe("r");
    expect(s.startedAt).toBe(1);
  });

  it("keeps the first character of the next item", () => {
    const s = run([
      { type: "change", value: "recieve", t: 1 },
      { type: "verdict" },
      { type: "item", itemKey: "w2" },
      { type: "change", value: "b", t: 50 },
    ]);
    expect(s.itemKey).toBe("w2");
    expect(s.value).toBe("b");
    expect(s.startedAt).toBe(50);
  });

  it("keeps a character typed while the previous verdict is showing", () => {
    let s = run([{ type: "change", value: "receive", t: 1 }, { type: "verdict" }, { type: "change", value: "receiveb", t: 20 }]);
    expect(s.advanceRequested).toBe(true);
    s = reduceAnswerInput(s, { type: "item", itemKey: "w2", carry: s.value, t: 20 });
    expect(s.value).toBe("b");
    expect(s.phase).toBe("answering");
    expect(s.startedAt).toBe(20);
  });

  it("keeps every character typed quickly during feedback, before the next item appears", () => {
    let s = run([{ type: "change", value: "cat", t: 1 }, { type: "verdict" }]);
    expect(displayValue(s)).toBe("cat");
    s = run([{ type: "change", value: "catd", t: 2 }, { type: "change", value: "catdo", t: 3 }], s);
    expect(s.value).toBe("do");
    s = reduceAnswerInput(s, { type: "item", itemKey: "w2" });
    expect(s.value).toBe("do");
    expect(s.startedAt).toBe(2);
  });

  it("handles a keyboard that replaces the whole field while showing the verdict", () => {
    const s = run([{ type: "change", value: "cat", t: 1 }, { type: "verdict" }, { type: "change", value: "d", t: 2 }]);
    expect(s.value).toBe("d");
    expect(s.advanceRequested).toBe(true);
  });

  it("keeps characters typed during IME composition (mobile keyboards)", () => {
    const s = run([
      { type: "compositionstart" },
      { type: "change", value: "w", t: 10 },
      { type: "change", value: "wh", t: 11 },
      { type: "compositionend", value: "whi", t: 12 },
    ]);
    expect(s.value).toBe("whi");
    expect(s.startedAt).toBe(10);
    expect(s.composing).toBe(false);
  });

  it("removes line breaks and caps the length without dropping the start", () => {
    const s = run([{ type: "change", value: `a\nb${"c".repeat(100)}`, t: 1 }]);
    expect(s.value.startsWith("ab")).toBe(true);
    expect(s.value).toHaveLength(MAX_ANSWER_LENGTH);
  });

  it("does not restart the clock when the field is cleared and retyped", () => {
    const s = run([
      { type: "change", value: "a", t: 5 },
      { type: "change", value: "", t: 6 },
      { type: "change", value: "b", t: 7 },
    ]);
    expect(s.value).toBe("b");
    expect(s.startedAt).toBe(5);
  });
});
