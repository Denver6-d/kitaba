"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n";
import { TypingSurface } from "@/features/typing/typing-surface";
import { useKeyCapture } from "@/features/typing/use-key-capture";
import { useTypingSession, type FinishedSession } from "@/features/typing/use-typing-session";
import { LayoutHint } from "@/features/typing/layout-hint";
import { AnimatedNumber } from "@/components/animated-number";
import { useSettings } from "@/lib/settings-store";

const DEMOS = [
  { ar: "أنا أتعلم الكتابة بالإنجليزية.", en: "I am learning to write in English." },
  { ar: "شكرًا على ردك السريع.", en: "Thank you for your quick reply." },
  { ar: "أعيش في مدينة جميلة.", en: "I live in a beautiful city." },
] as const;

/** The hero is the product: a real, untimed typing exercise on the ruled line. */
export function HeroDemo() {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const demo = DEMOS[index % DEMOS.length] ?? DEMOS[0];
  return (
    <div className="sheet relative p-6 sm:p-8">
      <p className="mb-1 text-xs font-medium text-brass">{t.home.demoLabel}</p>
      <p lang="ar" dir="rtl" className="font-arabic text-xl leading-relaxed font-semibold text-hint sm:text-2xl">
        {demo.ar}
      </p>
      <p className="mt-1 mb-5 text-sm text-ink-soft">{t.home.demoInstruction}</p>
      <DemoRun key={index} target={demo.en} focusOnMount={index > 0} onNext={() => setIndex((i) => i + 1)} />
    </div>
  );
}

function DemoRun({ target, focusOnMount, onNext }: { target: string; focusOnMount: boolean; onNext: () => void }) {
  const { t, num, pct } = useI18n();
  const [settings] = useSettings();
  const [done, setDone] = useState<FinishedSession | null>(null);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const onFinish = useCallback((s: FinishedSession) => setDone(s), []);
  const { snapshot, status, dispatch, reset } = useTypingSession({ target, durationSec: null, onFinish });
  useKeyCapture(inputRef, dispatch, { onEscape: reset, sounds: settings.keySounds, disabled: status === "finished" });

  // Focus the new sentence only after "another sentence" (never steal focus on page load).
  useEffect(() => {
    if (focusOnMount) inputRef.current?.focus({ preventScroll: true });
  }, [focusOnMount]);

  return (
    <>
      {snapshot.layoutWarning && (
        <div className="mb-4">
          <LayoutHint meant={[...snapshot.log].reverse().find((k) => k.kind === "layout-mismatch")?.intended ?? null} />
        </div>
      )}
      <div onFocusCapture={() => setFocused(true)} onBlurCapture={() => setFocused(false)}>
        <TypingSurface
          target={target}
          typed={snapshot.typed}
          ghostPos={null}
          focused={focused || status === "finished"}
          idle={status === "idle"}
          inputRef={inputRef}
          label={t.test.areaLabel}
          focusHint={t.test.focusHint}
          startHint={t.test.startHint}
        />
      </div>
      <div className="mt-10 flex min-h-11 flex-wrap items-center justify-between gap-3" aria-live="polite">
        {done ? (
          <>
            <p className="text-base">
              <span className="font-latin-display text-3xl font-medium tabular" dir="ltr">
                <AnimatedNumber value={Math.round(done.metrics.netWpm)} format={(n) => num(Math.round(n))} />
              </span>{" "}
              <span className="text-ink-soft">{t.common.wpmShort}</span>
              <span className="mx-3 text-rule-strong" aria-hidden="true">
                |
              </span>
              <span className="tabular">{pct(done.metrics.accuracy)}</span> <span className="text-ink-soft">{t.common.accuracy}</span>
            </p>
            <button type="button" onClick={onNext} className="rounded-md px-3 py-2 text-sm font-medium text-brass hover:bg-brass-wash">
              {t.home.demoAgain}
            </button>
          </>
        ) : null}
      </div>
    </>
  );
}
