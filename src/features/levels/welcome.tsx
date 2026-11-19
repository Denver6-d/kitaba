"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ClipboardCheck, ListChecks } from "lucide-react";
import { DEFAULT_LEVEL, LEVELS, type CefrLevel } from "@/domain/model";
import type { PlacementResult } from "@/domain/levels/placement";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { PlacementTest } from "./placement-test";
import { useLevels } from "./use-levels";

type Step =
  | { readonly kind: "menu" }
  | { readonly kind: "pick" }
  | { readonly kind: "test"; readonly seed: number }
  | { readonly kind: "done"; readonly level: CefrLevel; readonly result: PlacementResult | null };

/**
 * First visit (no level stored), or "retake the placement test" from settings:
 * choose a level, take the adaptive test, or skip (A2).
 */
export function Welcome({ startWithTest = false, onSkip, next = "/play" }: { startWithTest?: boolean; onSkip: () => void; next?: string }) {
  const { t } = useI18n();
  const { setAll } = useLevels();
  const [step, setStep] = useState<Step>(() => (startWithTest ? { kind: "test", seed: Date.now() } : { kind: "menu" }));
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to each new step's heading, so keyboard and screen-reader users follow along.
  useEffect(() => {
    if (step.kind !== "test") headingRef.current?.focus();
  }, [step.kind]);

  const onPlaced = useCallback(
    (result: PlacementResult) => {
      void setAll(result.level, "placement").then(() => setStep({ kind: "done", level: result.level, result }));
    },
    [setAll],
  );

  if (step.kind === "test") return <PlacementTest seed={step.seed} onDone={onPlaced} />;

  if (step.kind === "done") {
    const r = step.result;
    return (
      <section className="sheet space-y-5 p-6 sm:p-8">
        <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-bold outline-none sm:text-3xl">
          {t.placement.resultTitle(step.level)}
        </h2>
        {r && <p className="text-lg">{t.placement.explain(r.at, r.above, step.level)}</p>}
        <p className="text-hint">{t.levels.desc[step.level]}</p>
        <p className="text-ink-soft">{t.welcome.setAll(step.level)}</p>
        <Button asChild size="lg" className="h-12 px-8 text-base">
          <Link href={next}>{t.placement.startPlaying}</Link>
        </Button>
      </section>
    );
  }

  if (step.kind === "pick") {
    return (
      <section className="space-y-5">
        <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-bold outline-none">
          {t.welcome.pickTitle}
        </h2>
        <ul className="grid gap-3">
          {LEVELS.map((l) => (
            <li key={l}>
              <button
                type="button"
                onClick={() => void setAll(l, "choice").then(() => setStep({ kind: "done", level: l, result: null }))}
                className="sheet flex min-h-16 w-full items-center gap-4 p-4 text-start transition-colors hover:bg-brass-wash"
              >
                <span className="w-12 shrink-0 font-mono text-xl font-semibold text-brass" dir="ltr">
                  {l}
                </span>
                <span className="space-y-0.5">
                  <span className="block font-semibold">{t.common.levels[l]}</span>
                  <span className="block text-sm text-ink-soft">{t.levels.desc[l]}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setStep({ kind: "menu" })} className="min-h-11 text-ink-soft underline underline-offset-4">
          {t.common.back}
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 ref={headingRef} tabIndex={-1} className="text-3xl font-bold outline-none sm:text-4xl">
          {t.welcome.title}
        </h2>
        <p className="max-w-2xl text-ink-soft">{t.welcome.intro}</p>
      </div>
      {/* The placement test is the recommended path: first, filled and largest. The other two are secondary. */}
      <div className="space-y-3">
        <Button type="button" size="lg" data-welcome="test" onClick={() => setStep({ kind: "test", seed: Date.now() })} className="h-auto min-h-16 w-full gap-3 px-6 py-4 text-xl font-semibold sm:w-auto sm:min-w-80">
          <ClipboardCheck className="size-6" aria-hidden="true" />
          {t.welcome.test}
        </Button>
        <p className="max-w-xl text-ink-soft">{t.welcome.testDesc}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-rule pt-5">
        <Button type="button" variant="outline" data-welcome="choose" onClick={() => setStep({ kind: "pick" })} className="h-11 gap-2">
          <ListChecks className="size-4" aria-hidden="true" />
          {t.welcome.choose}
        </Button>
        <Button type="button" variant="ghost" data-welcome="skip" onClick={() => void setAll(DEFAULT_LEVEL, "skip").then(onSkip)} className="h-11 text-ink-soft underline underline-offset-4 hover:text-ink">
          {t.welcome.skip}
        </Button>
      </div>
    </section>
  );
}
