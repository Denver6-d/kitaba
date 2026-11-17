"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useReducer, useRef, type Dispatch } from "react";
import {
  displayValue,
  initialAnswerInput,
  MAX_ANSWER_LENGTH,
  reduceAnswerInput,
  type AnswerInputEvent,
  type AnswerInputState,
} from "@/domain/spelling/answer-input";

export type AnswerTone = "idle" | "correct" | "wrong";

interface Props {
  readonly state: AnswerInputState;
  readonly dispatch: Dispatch<AnswerInputEvent>;
  /** Enter outside an IME composition. */
  readonly onEnter: () => void;
  readonly label: string;
  readonly tone?: AnswerTone;
  readonly describedBy?: string;
  readonly placeholder?: string;
  readonly size?: "md" | "lg";
  readonly id?: string;
  readonly autoFocus?: boolean;
}

/**
 * The one answer field of a game session (DECISIONS B1). It is never keyed by
 * item, so it stays mounted, focused and attached to the virtual keyboard from
 * the first word to the last. The value lives in the answer-input reducer; this
 * component only forwards the input's committed value.
 */
export const SpellingInput = forwardRef<HTMLInputElement, Props>(function SpellingInput(
  { state, dispatch, onEnter, label, tone = "idle", describedBy, placeholder, size = "lg", id, autoFocus },
  ref,
) {
  const inner = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inner.current as HTMLInputElement, []);

  // Keep the field (and the action under it) above the virtual keyboard on phones.
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    const keepVisible = () => {
      const el = inner.current;
      if (!el || document.activeElement !== el) return;
      const rect = el.getBoundingClientRect();
      // Leave room below the field for the Check button.
      if (rect.bottom + 96 > vv.height || rect.top < 0) el.scrollIntoView({ block: "center", behavior: "auto" });
    };
    vv.addEventListener("resize", keepVisible);
    return () => vv.removeEventListener("resize", keepVisible);
  }, []);

  const toneClass =
    tone === "correct"
      ? "border-correct text-correct"
      : tone === "wrong"
        ? "border-error text-error answer-shake"
        : "border-input focus:border-brass-fill";

  return (
    <input
      ref={inner}
      id={id}
      autoFocus={autoFocus}
      type="text"
      value={displayValue(state)}
      onChange={(e) => dispatch({ type: "change", value: e.target.value, t: performance.now() })}
      onCompositionStart={() => dispatch({ type: "compositionstart" })}
      onCompositionEnd={(e) => dispatch({ type: "compositionend", value: e.currentTarget.value, t: performance.now() })}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
          e.preventDefault();
          onEnter();
        }
      }}
      aria-label={label}
      aria-describedby={describedBy}
      aria-invalid={tone === "wrong" ? true : undefined}
      placeholder={placeholder}
      maxLength={MAX_ANSWER_LENGTH}
      dir="ltr"
      lang="en"
      // A spelling test is ruined by any automatic correction.
      autoCapitalize="off"
      autoCorrect="off"
      autoComplete="off"
      spellCheck={false}
      inputMode="text"
      enterKeyHint="go"
      data-gramm="false"
      className={`w-full min-w-0 rounded-[10px] border-2 bg-paper px-4 font-mono tracking-wide outline-none transition-colors ${
        size === "lg" ? "h-14 text-2xl sm:h-16 sm:text-[1.75rem]" : "h-12 text-xl"
      } ${toneClass}`}
    />
  );
});

/** Reducer-backed state for a SpellingInput, plus stable helpers. */
export function useAnswerInput(firstItemKey: string) {
  const [state, dispatch] = useReducer(reduceAnswerInput, firstItemKey, initialAnswerInput);
  const markChecked = useCallback(() => dispatch({ type: "verdict" }), []);
  return { state, dispatch, markChecked };
}
