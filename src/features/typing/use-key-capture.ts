"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { TypingInput } from "@/domain/typing/engine";
import { playClick } from "@/lib/sound";

const SENTINEL = " ";

/**
 * Captures typing from a transparent <textarea>. Using the `input` event (and
 * diffing the textarea value) works with physical keyboards, mobile keyboards
 * and IMEs alike. The physical key (event.code) of the latest keydown is
 * attached to the inserted character for Arabic-layout detection.
 */
export function useKeyCapture(
  ref: RefObject<HTMLTextAreaElement | null>,
  dispatch: (input: TypingInput) => void,
  options: { readonly onEscape?: () => void; readonly sounds?: boolean; readonly disabled?: boolean },
) {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.value = SENTINEL;
    let last = SENTINEL;
    let lastKey: { code: string; shift: boolean; at: number } | null = null;
    let composing = false;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        optionsRef.current.onEscape?.();
        return;
      }
      // Keep the caret at the end so arrow keys or Home cannot move input elsewhere.
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) e.preventDefault();
      if (e.key === "Enter") e.preventDefault();
      lastKey = { code: e.code, shift: e.shiftKey, at: performance.now() };
      if (optionsRef.current.sounds && !e.repeat && e.key.length === 1) playClick();
    };

    const onInput = () => {
      if (optionsRef.current.disabled) {
        el.value = SENTINEL;
        last = SENTINEL;
        return;
      }
      const value = el.value;
      let p = 0;
      while (p < last.length && p < value.length && last[p] === value[p]) p += 1;
      const t = performance.now();
      for (let i = 0; i < last.length - p; i += 1) dispatch({ kind: "backspace", t });
      const inserted = value.slice(p);
      const key = lastKey && t - lastKey.at < 80 && inserted.length === 1 ? lastKey : null;
      for (const char of inserted) {
        if (char === "\n") continue;
        dispatch(key ? { kind: "char", char, code: key.code, shift: key.shift, t } : { kind: "char", char, t });
      }
      last = value;
      if (!composing && (value.length === 0 || value.length > 48)) {
        el.value = SENTINEL;
        last = SENTINEL;
      }
    };

    const onCompStart = () => {
      composing = true;
    };
    const onCompEnd = () => {
      composing = false;
    };
    // The sentinel space lets a mobile keyboard send backspace even when we have consumed all text.
    const keepCaretAtEnd = () => el.setSelectionRange(el.value.length, el.value.length);

    el.addEventListener("keydown", onKeyDown);
    el.addEventListener("input", onInput);
    el.addEventListener("compositionstart", onCompStart);
    el.addEventListener("compositionend", onCompEnd);
    el.addEventListener("select", keepCaretAtEnd);
    el.addEventListener("focus", keepCaretAtEnd);
    return () => {
      el.removeEventListener("keydown", onKeyDown);
      el.removeEventListener("input", onInput);
      el.removeEventListener("compositionstart", onCompStart);
      el.removeEventListener("compositionend", onCompEnd);
      el.removeEventListener("select", keepCaretAtEnd);
      el.removeEventListener("focus", keepCaretAtEnd);
    };
  }, [ref, dispatch]);
}
