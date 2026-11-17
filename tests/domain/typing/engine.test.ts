import { describe, expect, it } from "vitest";
import {
  applyInput,
  createEngine,
  isFinished,
  LAYOUT_WARNING_THRESHOLD,
  type EngineState,
  type TypingInput,
} from "@/domain/typing/engine";

function typeString(state: EngineState, text: string, start = 1000, step = 100): EngineState {
  let s = state;
  let t = start;
  for (const ch of text) {
    s = applyInput(s, { kind: "char", char: ch, t });
    t += step;
  }
  return s;
}

describe("createEngine", () => {
  it("starts empty and not started", () => {
    const s = createEngine("hello world");
    expect(s.typed).toBe("");
    expect(s.startedAt).toBeNull();
    expect(s.log).toHaveLength(0);
  });
});

describe("applyInput: characters", () => {
  it("starts the clock on the first keystroke", () => {
    const s = applyInput(createEngine("abc"), { kind: "char", char: "a", t: 5000 });
    expect(s.startedAt).toBe(5000);
  });

  it("records correct and error keystrokes against the expected character", () => {
    const s = typeString(createEngine("cat"), "cut");
    expect(s.typed).toBe("cut");
    expect(s.log.map((k) => k.kind)).toEqual(["correct", "error", "correct"]);
    expect(s.log[1]).toMatchObject({ expected: "a", typed: "u" });
    expect(s.correctKeystrokes).toBe(2);
    expect(s.errorKeystrokes).toBe(1);
  });

  it("ignores characters beyond the end of the target", () => {
    const s = typeString(createEngine("ab"), "abc");
    expect(s.typed).toBe("ab");
    expect(isFinished(s)).toBe(true);
  });

  it("ignores non-typable characters such as newlines", () => {
    const s = applyInput(createEngine("ab"), { kind: "char", char: "\n", t: 1 });
    expect(s.typed).toBe("");
    expect(s.log).toHaveLength(0);
  });
});

describe("applyInput: backspace", () => {
  it("removes the last character and logs a correction", () => {
    let s = typeString(createEngine("cat"), "cu");
    s = applyInput(s, { kind: "backspace", t: 2000 });
    expect(s.typed).toBe("c");
    expect(s.log.at(-1)?.kind).toBe("correction");
    // corrected errors still count against accuracy
    expect(s.errorKeystrokes).toBe(1);
  });

  it("is a no-op on an empty buffer (but does not start the clock)", () => {
    const s = applyInput(createEngine("cat"), { kind: "backspace", t: 1 });
    expect(s.typed).toBe("");
    expect(s.startedAt).toBeNull();
    expect(s.log).toHaveLength(0);
  });
});

describe("applyInput: Arabic layout detection", () => {
  const arabic = (char: string, code: string | undefined, t: number): TypingInput =>
    code === undefined ? { kind: "char", char, t } : { kind: "char", char, code, t };

  it("treats an Arabic character on an English test as a layout mismatch, not a typo", () => {
    // the user meant "h" (KeyH) but the Arabic layout produced "ا"
    const s = applyInput(createEngine("hi"), arabic("ا", "KeyH", 100));
    expect(s.typed).toBe("");
    expect(s.errorKeystrokes).toBe(0);
    expect(s.layoutMismatches).toBe(1);
    expect(s.log[0]).toMatchObject({ kind: "layout-mismatch", expected: "h", intended: "h" });
  });

  it("raises the warning after consecutive mismatches and clears it on a Latin keystroke", () => {
    let s = createEngine("hello");
    for (let i = 0; i < LAYOUT_WARNING_THRESHOLD; i += 1) {
      s = applyInput(s, arabic("ا", "KeyH", 100 + i));
    }
    expect(s.layoutWarning).toBe(true);
    s = applyInput(s, { kind: "char", char: "h", t: 500 });
    expect(s.layoutWarning).toBe(false);
    expect(s.typed).toBe("h");
  });

  it("does not start the clock on layout mismatches", () => {
    const s = applyInput(createEngine("hi"), arabic("ا", "KeyH", 100));
    expect(s.startedAt).toBeNull();
  });

  it("uses the fallback layout map when no physical code is available", () => {
    const s = applyInput(createEngine("hi"), arabic("ا", undefined, 100));
    expect(s.log[0]).toMatchObject({ intended: "h" });
  });
});
