"use client";

import { memo, useLayoutEffect, useMemo, useRef, type RefObject } from "react";

interface WordProps {
  readonly word: string;
  readonly start: number;
  /** The slice of typed text that falls inside this word. */
  readonly typed: string;
}

/** One word. Memoised on its typed slice, so a keystroke re-renders only the current word. */
const Word = memo(function Word({ word, start, typed }: WordProps) {
  return (
    <span className="inline">
      {[...word].map((ch, i) => {
        const t = typed[i];
        const state = t === undefined ? "todo" : t === ch ? "ok" : "bad";
        return (
          <span
            key={i}
            data-i={start + i}
            className={
              state === "ok"
                ? "text-ink"
                : state === "bad"
                  ? "rounded-[3px] bg-[var(--error-wash)] text-error underline decoration-error decoration-2 underline-offset-[6px]"
                  : "text-ink-soft"
            }
          >
            {ch === " " ? (state === "bad" ? "·" : " ") : ch}
          </span>
        );
      })}
    </span>
  );
});

interface Props {
  readonly target: string;
  readonly typed: string;
  readonly ghostPos: number | null;
  readonly focused: boolean;
  readonly idle: boolean;
  readonly inputRef: RefObject<HTMLTextAreaElement | null>;
  readonly label: string;
  readonly focusHint: string;
  readonly startHint: string;
  readonly describedBy?: string;
}

const LINES_VISIBLE = 3;

/**
 * The writing line. Text is LTR English inside the RTL UI. The caret is a brass
 * nib moved with transforms; nothing animates while the user types.
 */
export function TypingSurface({ target, typed, ghostPos, focused, idle, inputRef, label, focusHint, startHint, describedBy }: Props) {
  const words = useMemo(() => {
    const out: Array<{ word: string; start: number }> = [];
    const re = /\S+\s?|\s/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(target))) out.push({ word: m[0], start: m.index });
    return out;
  }, [target]);

  const innerRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);
  const ghostRef = useRef<HTMLSpanElement>(null);

  // Position caret and scroll lines in one layout pass per keystroke.
  useLayoutEffect(() => {
    const inner = innerRef.current;
    const caret = caretRef.current;
    if (!inner || !caret) return;
    const index = Math.min(typed.length, target.length - 1);
    const span = inner.querySelector<HTMLSpanElement>(`[data-i="${index}"]`);
    if (!span) return;
    const lineHeight = span.offsetHeight || 1;
    const atEnd = typed.length >= target.length;
    const x = span.offsetLeft + (atEnd ? span.offsetWidth : 0);
    const y = span.offsetTop;
    caret.style.transform = `translate(${x}px, ${y}px)`;
    caret.style.height = `${lineHeight}px`;
    const line = Math.round(y / lineHeight);
    const offset = Math.max(0, line - 1) * lineHeight;
    inner.style.transform = `translateY(${-offset}px)`;
  }, [typed, target]);

  useLayoutEffect(() => {
    const inner = innerRef.current;
    const ghost = ghostRef.current;
    if (!inner || !ghost) return;
    if (ghostPos === null) {
      ghost.style.opacity = "0";
      return;
    }
    const span = inner.querySelector<HTMLSpanElement>(`[data-i="${Math.min(ghostPos, target.length - 1)}"]`);
    if (!span) return;
    ghost.style.opacity = "1";
    ghost.style.height = `${span.offsetHeight}px`;
    ghost.style.transform = `translate(${span.offsetLeft}px, ${span.offsetTop}px)`;
  }, [ghostPos, target]);

  return (
    <div className="relative" dir="ltr" lang="en">
      <div
        className="relative overflow-hidden font-mono text-[1.35rem] sm:text-[1.6rem]"
        style={{ height: `${LINES_VISIBLE * 2.4}em`, lineHeight: "2.4em" }}
      >
        <div
          ref={innerRef}
          className="ruled relative whitespace-pre-wrap break-words will-change-transform"
          style={{ backgroundSize: "100% 2.4em" }}
          aria-hidden="true"
        >
          {words.map((w) => (
            <Word key={w.start} word={w.word} start={w.start} typed={typed.slice(w.start, w.start + w.word.length)} />
          ))}
          <span
            ref={ghostRef}
            className="pointer-events-none absolute top-0 w-[2px] rounded-full bg-hint/50 opacity-0"
            style={{ left: 0 }}
          />
          <span
            ref={caretRef}
            className={`pointer-events-none absolute top-0 w-[3px] rounded-full bg-brass-fill ${idle && focused ? "animate-[caret-blink_1.1s_steps(2)_infinite]" : ""}`}
            style={{ left: 0 }}
          />
        </div>
      </div>

      <textarea
        ref={inputRef}
        aria-label={label}
        aria-describedby={describedBy}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
        enterKeyHint="next"
        dir="ltr"
        lang="en"
        className="absolute inset-0 h-full w-full resize-none cursor-text bg-transparent text-base text-transparent caret-transparent opacity-0 outline-none"
      />

      {!focused && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 grid place-items-center pb-2" dir="auto">
          <span className="rounded-full bg-sheet px-4 py-2 text-sm font-medium shadow-float">{focusHint}</span>
        </div>
      )}
      {focused && idle && typed.length === 0 && (
        <p className="pointer-events-none absolute -bottom-7 start-0 text-sm text-ink-soft" dir="auto">
          {startHint}
        </p>
      )}
    </div>
  );
}
