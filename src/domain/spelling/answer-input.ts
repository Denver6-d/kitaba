/**
 * State of the one answer input that stays mounted for a whole game session
 * (DECISIONS B1). The first-character bug came from replacing or resetting the
 * input around the first keystroke; these rules make that impossible:
 *
 * 1. The value only ever comes from the input's committed value (`change`),
 *    never from keydown, so IME composition and mobile keyboards work.
 * 2. The first non-empty change starts the item's clock in the same update
 *    that stores the character. Nothing else reacts to the first keystroke.
 * 3. Moving to the next item clears the value in the same update that changes
 *    the item. A repeated `item` event for the current item is a no-op, so a
 *    re-render or a re-run effect can never wipe what was typed.
 * 4. Typing while the previous verdict is showing advances to the next item
 *    and keeps the character as the start of the new answer.
 */

export type AnswerPhase = "answering" | "feedback";

export interface AnswerInputState {
  readonly itemKey: string;
  /** The answer being typed (in the feedback phase: what was typed after the checked answer). */
  readonly value: string;
  /** The answer that was checked (feedback phase only). */
  readonly checked: string;
  readonly phase: AnswerPhase;
  /** When the first character of this item was typed (ms), or null. */
  readonly startedAt: number | null;
  readonly composing: boolean;
  /** Set when typing in the feedback phase asked to move on; the caller then advances. */
  readonly advanceRequested: boolean;
}

export type AnswerInputEvent =
  | { readonly type: "keydown"; readonly t: number }
  | { readonly type: "change"; readonly value: string; readonly t: number }
  | { readonly type: "compositionstart" }
  | { readonly type: "compositionend"; readonly value: string; readonly t: number }
  | { readonly type: "verdict" }
  | { readonly type: "item"; readonly itemKey: string; readonly carry?: string; readonly t?: number };

export const MAX_ANSWER_LENGTH = 64;

export function initialAnswerInput(itemKey: string): AnswerInputState {
  return { itemKey, value: "", checked: "", phase: "answering", startedAt: null, composing: false, advanceRequested: false };
}

/** Removes line breaks and caps the length; keeps everything else exactly as typed. */
export function sanitizeAnswer(raw: string): string {
  return raw.replace(/[\r\n]/g, "").slice(0, MAX_ANSWER_LENGTH);
}

export function reduceAnswerInput(state: AnswerInputState, event: AnswerInputEvent): AnswerInputState {
  switch (event.type) {
    // A keydown never changes state: the character is not in the input yet.
    case "keydown":
      return state;
    case "compositionstart":
      return state.composing ? state : { ...state, composing: true };
    case "compositionend":
      return applyValue({ ...state, composing: false }, event.value, event.t);
    case "change":
      return applyValue(state, event.value, event.t);
    case "verdict":
      return state.phase === "feedback" ? state : { ...state, phase: "feedback", checked: state.value, value: "", advanceRequested: false };
    case "item": {
      if (event.itemKey === state.itemKey) return state;
      const carry = sanitizeAnswer(event.carry ?? (state.advanceRequested ? state.value : ""));
      return {
        itemKey: event.itemKey,
        value: carry,
        checked: "",
        phase: "answering",
        startedAt: carry.length > 0 ? (state.advanceRequested && state.startedAt !== null ? state.startedAt : (event.t ?? null)) : null,
        composing: false,
        advanceRequested: false,
      };
    }
  }
}

/** What the input element shows: in the feedback phase, the checked answer plus anything typed after it. */
export function displayValue(state: AnswerInputState): string {
  return state.phase === "feedback" ? state.checked + state.value : state.value;
}

function applyValue(state: AnswerInputState, raw: string, t: number): AnswerInputState {
  const value = sanitizeAnswer(raw);
  if (state.phase === "feedback") {
    // The input still shows the checked answer; anything typed after it starts the next item.
    const typed = value.startsWith(state.checked) ? value.slice(state.checked.length) : value;
    if (typed === state.value) return state;
    const startedAt = typed.length === 0 ? null : state.advanceRequested && state.startedAt !== null ? state.startedAt : t;
    return { ...state, value: typed, startedAt, advanceRequested: typed.length > 0 };
  }
  if (value === state.value) return state;
  return { ...state, value, startedAt: state.startedAt ?? (value.length > 0 ? t : null) };
}
