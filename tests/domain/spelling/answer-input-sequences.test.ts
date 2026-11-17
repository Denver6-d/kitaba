import { describe, expect, it } from "vitest";
import {
  displayValue,
  initialAnswerInput,
  reduceAnswerInput,
  type AnswerInputEvent,
  type AnswerInputState,
} from "@/domain/spelling/answer-input";

/**
 * Event sequences as the browser and GameSession produce them (DECISIONS B1).
 *
 * The browser edits whatever the field currently shows, so every change event
 * here is built from `displayValue(state)`, never from what the reducer keeps
 * internally. GameSession advances (an `item` event with `t` and no `carry`)
 * as soon as the reducer sets `advanceRequested`; React applies both in order.
 */
const run = (events: readonly AnswerInputEvent[], start: AnswerInputState = initialAnswerInput("w1")) =>
  events.reduce(reduceAnswerInput, start);

/** The browser's `input` event after typing `ch` at the end of the field. */
const typed = (s: AnswerInputState, ch: string, t: number): AnswerInputEvent => ({ type: "change", value: displayValue(s) + ch, t });
/** The browser's `input` event after Backspace at the end of the field. */
const backspace = (s: AnswerInputState, t: number): AnswerInputEvent => ({ type: "change", value: displayValue(s).slice(0, -1), t });

/** GameSession.onInputEvent: dispatch, then advance when the reducer asks for it. */
function inGame(s: AnswerInputState, ev: AnswerInputEvent, nextKey: string, t: number): AnswerInputState {
  const after = reduceAnswerInput(s, ev);
  return after.advanceRequested ? reduceAnswerInput(after, { type: "item", itemKey: nextKey, t }) : after;
}

const answered = (word: string) => run([{ type: "change", value: word, t: 1 }, { type: "verdict" }]);

describe("answer input: the production advance path", () => {
  it("keeps the first character typed while the verdict shows", () => {
    const s = inGame(answered("recieve"), typed(answered("recieve"), "b", 30), "w2", 31);
    expect(s).toMatchObject({ itemKey: "w2", value: "b", phase: "answering", startedAt: 30, advanceRequested: false });
    expect(displayValue(s)).toBe("b");
  });

  it("keeps every following character on the next word", () => {
    let s = inGame(answered("cat"), typed(answered("cat"), "d", 30), "w2", 31);
    s = inGame(s, typed(s, "o", 32), "w3", 33);
    s = inGame(s, typed(s, "g", 34), "w3", 35);
    expect(s).toMatchObject({ itemKey: "w2", value: "dog", startedAt: 30 });
  });

  it("starts the next word empty after Enter, then keeps its first character and starts its clock", () => {
    let s = reduceAnswerInput(answered("cat"), { type: "item", itemKey: "w2", t: 40 });
    expect(s).toMatchObject({ value: "", startedAt: null, phase: "answering" });
    expect(displayValue(s)).toBe("");
    s = run([{ type: "keydown", t: 49 }, typed(s, "d", 50)], s);
    expect(s).toMatchObject({ value: "d", startedAt: 50 });
  });

  it("keeps the first character of every word across a whole session", () => {
    let s = initialAnswerInput("w1");
    for (let n = 1; n <= 5; n += 1) {
      const t = n * 100;
      s = reduceAnswerInput(s, typed(s, "x", t));
      s = reduceAnswerInput(s, typed(s, "y", t + 1));
      s = reduceAnswerInput(s, { type: "verdict" });
      s = reduceAnswerInput(s, { type: "item", itemKey: `w${n + 1}`, t: t + 50 });
      s = reduceAnswerInput(s, typed(s, "q", t + 60));
      expect(s).toMatchObject({ itemKey: `w${n + 1}`, value: "q", startedAt: t + 60 });
      s = reduceAnswerInput(s, backspace(s, t + 61));
    }
  });

  it("keeps a whole pasted answer from one change event", () => {
    expect(run([{ type: "change", value: "accommodate", t: 7 }])).toMatchObject({ value: "accommodate", startedAt: 7 });
  });
});

describe("answer input: while the verdict shows", () => {
  it("lets typing start the next word after 'I don't know' (nothing was typed)", () => {
    const s0 = run([{ type: "verdict" }]);
    const s = inGame(s0, typed(s0, "b", 9), "w2", 10);
    expect(s).toMatchObject({ itemKey: "w2", value: "b", startedAt: 9 });
  });

  it("ignores a second verdict, a repeated item event and keydown", () => {
    const s = answered("cat");
    expect(reduceAnswerInput(s, { type: "verdict" })).toBe(s);
    expect(reduceAnswerInput(s, { type: "item", itemKey: "w1" })).toBe(s);
    expect(reduceAnswerInput(s, { type: "keydown", t: 5 })).toBe(s);
  });

  it("withdraws the advance when the letter typed after the verdict is deleted again", () => {
    let s = reduceAnswerInput(answered("cat"), typed(answered("cat"), "d", 2));
    s = reduceAnswerInput(s, backspace(s, 3));
    expect(s).toMatchObject({ value: "", advanceRequested: false, startedAt: null, phase: "feedback" });
  });

  // Fails at commit 4001183: Backspace on the shown answer "cat" gave "ca", which
  // requested the advance and pre-filled the next word with "ca".
  it("does not carry the checked answer into the next word after Backspace", () => {
    const s0 = answered("cat");
    const s = inGame(s0, backspace(s0, 2), "w2", 3);
    expect(s.value).toBe("");
    expect(displayValue(s)).toBe("");
  });
});

describe("answer input: IME composition across items", () => {
  it("keeps every composed character when a composition starts during feedback", () => {
    let s = reduceAnswerInput(answered("cat"), { type: "compositionstart" });
    for (const [i, ch] of ["w", "h", "o"].entries()) s = inGame(s, typed(s, ch, 10 + i), "w2", 20 + i);
    s = inGame(s, { type: "compositionend", value: displayValue(s), t: 30 }, "w2", 31);
    expect(s).toMatchObject({ itemKey: "w2", value: "who", startedAt: 10, composing: false, phase: "answering" });
  });

  it("keeps the committed text when composition ends without a separate change event", () => {
    expect(run([{ type: "compositionstart" }, { type: "compositionend", value: "w", t: 4 }])).toMatchObject({ value: "w", startedAt: 4, composing: false });
  });

  it("does not let a repeated compositionstart reset anything", () => {
    const s = run([{ type: "compositionstart" }, { type: "change", value: "a", t: 1 }]);
    expect(reduceAnswerInput(s, { type: "compositionstart" })).toBe(s);
  });
});
