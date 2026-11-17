"use client";

import { useEffect, useId, useRef, useState } from "react";
import { RotateCcw, Keyboard as KeyboardIcon } from "lucide-react";
import { ghostPositionAt, type Ghost } from "@/domain/typing/ghost";
import { segmentAt, type TextSegment } from "@/domain/typing/text";
import { useI18n } from "@/i18n";
import { useSettings } from "@/lib/settings-store";
import { KeyboardSvg } from "@/features/keyboard/keyboard-svg";
import { keyForChar } from "@/features/keyboard/geometry";
import { TypingSurface } from "./typing-surface";
import { useKeyCapture } from "./use-key-capture";
import { useTypingSession, type FinishedSession } from "./use-typing-session";
import { LayoutHint } from "./layout-hint";

interface Props {
  readonly target: string;
  readonly durationSec: number | null;
  readonly onFinish: (session: FinishedSession) => void;
  readonly onRestart?: () => void;
  readonly ghost?: Ghost | null;
  readonly segments?: readonly TextSegment[];
  /** Arabic meaning (or note) for a segment id; null hides it (faded hints). */
  readonly meaningFor?: (segmentId: string) => string | null;
  readonly autoFocus?: boolean;
}

export function TypingRun({ target, durationSec, onFinish, onRestart, ghost, segments, meaningFor, autoFocus = true }: Props) {
  const { t, num, pct } = useI18n();
  const [settings, update] = useSettings();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);
  const [ghostPos, setGhostPos] = useState<number | null>(null);
  const hintId = useId();

  const session = useTypingSession({ target, durationSec, onFinish });
  const { snapshot, status, live, remaining, dispatch, reset } = session;

  const restart = () => {
    reset();
    onRestart?.();
    inputRef.current?.focus();
  };

  useKeyCapture(inputRef, dispatch, { onEscape: restart, sounds: settings.keySounds, disabled: status === "finished" });

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const on = () => setFocused(true);
    const off = () => setFocused(false);
    el.addEventListener("focus", on);
    el.addEventListener("blur", off);
    return () => {
      el.removeEventListener("focus", on);
      el.removeEventListener("blur", off);
    };
  }, []);

  // Registered after the focus listeners above, so the focus event is observed.
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus({ preventScroll: true });
  }, [autoFocus, target]);

  // Ghost replay at 10 Hz while running.
  useEffect(() => {
    if (!settings.showGhost || !ghost || ghost.length === 0 || status !== "running" || snapshot.startedAt === null) return;
    const start = snapshot.startedAt;
    const id = window.setInterval(() => setGhostPos(ghostPositionAt(ghost, performance.now() - start)), 100);
    return () => window.clearInterval(id);
  }, [ghost, status, snapshot.startedAt, settings.showGhost]);

  const caret = snapshot.typed.length;
  const nextChar = target[caret] ?? "";
  const nextKey = keyForChar(nextChar);
  const lastMismatch = [...snapshot.log].reverse().find((k) => k.kind === "layout-mismatch");
  const segment = segments ? segmentAt(segments, caret) : undefined;
  const meaning = segment && meaningFor ? meaningFor(segment.id) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <dl className="flex items-end gap-6 tabular" aria-live="off">
          {remaining !== null && (
            <div>
              <dt className="text-xs text-ink-soft">{t.test.timeLeft}</dt>
              <dd className="font-latin-display text-3xl leading-none text-brass">{num(remaining)}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-ink-soft">{t.common.wpmShort}</dt>
            <dd className="text-2xl leading-none font-semibold">{num(Math.round(live.netWpm))}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-soft">{t.common.accuracy}</dt>
            <dd className="text-2xl leading-none font-semibold">{pct(live.accuracy)}</dd>
          </div>
        </dl>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => update({ showKeyboard: !settings.showKeyboard })}
            aria-pressed={settings.showKeyboard}
            className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm text-ink-soft hover:bg-muted hover:text-ink"
          >
            <KeyboardIcon className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t.test.keyboard}</span>
          </button>
          <button
            type="button"
            onClick={restart}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-rule bg-sheet px-3 text-sm hover:border-rule-strong"
            title={t.test.restartShortcut}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            {t.test.restart}
          </button>
        </div>
      </div>

      {snapshot.layoutWarning && <LayoutHint meant={lastMismatch?.intended ?? null} />}

      <div className="sheet px-5 pt-6 pb-9 sm:px-8">
        <p className="mb-3 min-h-[1.5rem] text-sm text-hint" lang="ar" dir="rtl">
          {meaning ? (
            <>
              <span className="sr-only">{t.test.translation}: </span>
              {meaning}
            </>
          ) : null}
        </p>
        <TypingSurface
          target={target}
          typed={snapshot.typed}
          ghostPos={settings.showGhost && status === "running" ? ghostPos : null}
          focused={focused}
          idle={status === "idle"}
          inputRef={inputRef}
          label={t.test.areaLabel}
          focusHint={t.test.focusHint}
          startHint={t.test.startHint}
          describedBy={hintId}
        />
        <p id={hintId} className="sr-only">
          {t.test.restartShortcut}
        </p>
      </div>

      {settings.showKeyboard && (
        <KeyboardSvg
          nextKey={nextKey?.id ?? null}
          shift={nextKey?.shift ?? false}
          label={t.test.keyboard}
          className="mx-auto hidden max-w-2xl md:block"
        />
      )}
      {ghost && ghost.length > 0 && settings.showGhost && <p className="text-xs text-ink-soft">{t.test.ghostHint}</p>}
    </div>
  );
}
