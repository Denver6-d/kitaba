"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { DEFAULT_LEVEL, LEVELS, type CefrLevel } from "@/domain/model";
import type { PlacementResult } from "@/domain/levels/placement";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { MomentLabel } from "@/components/ui/card";
import { chipVariants, LevelChip } from "@/components/ui/chip";
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
  const tagId = useId();

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

  if (step.kind === "test") return <PlacementTest seed={step.seed} onDone={onPlaced} onExit={() => setStep({ kind: "menu" })} />;

  if (step.kind === "done") {
    const r = step.result;
    return (
      <div className="space-y-8 pt-4 sm:pt-10">
        <section className="moment space-y-4 p-6 sm:p-10">
          <MomentLabel>{t.placement.title}</MomentLabel>
          <h2 ref={headingRef} tabIndex={-1} className="text-[clamp(1.75rem,6vw,2.75rem)] leading-tight font-light text-on-mint outline-none">
            {t.placement.resultTitle(step.level)}
          </h2>
          {r && <p className="text-lg text-on-mint">{t.placement.explain(r.at, r.above, step.level)}</p>}
          <p className="text-on-mint-2">{t.levels.desc[step.level]}</p>
          <p className="text-on-mint-2">{t.welcome.setAll(step.level)}</p>
        </section>
        <Button variant="primary" asChild size="lg" className="w-full sm:w-auto sm:min-w-64">
          <Link href={next}>{t.placement.startPlaying}</Link>
        </Button>
      </div>
    );
  }

  if (step.kind === "pick") {
    return (
      <section className="space-y-6 pt-4 sm:pt-10">
        <h2 ref={headingRef} tabIndex={-1} className="text-[clamp(1.75rem,6vw,2.75rem)] leading-tight font-light outline-none">
          {t.welcome.pickTitle}
        </h2>
        <ul className="grid gap-3">
          {LEVELS.map((l) => (
            <li key={l}>
              <button
                type="button"
                onClick={() => void setAll(l, "choice").then(() => setStep({ kind: "done", level: l, result: null }))}
                className="flex min-h-16 w-full items-center gap-4 rounded-card border border-line bg-surface p-4 text-start transition-colors hover:border-line-strong hover:bg-raised sm:p-5"
              >
                <LevelChip level={l} size="lg" className="w-14" />
                <span className="min-w-0 space-y-0.5">
                  <span className="block font-medium">{t.common.levels[l]}</span>
                  <span className="block text-sm text-fg-2">{t.levels.desc[l]}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <Button type="button" variant="link" onClick={() => setStep({ kind: "menu" })}>
          {t.common.back}
        </Button>
      </section>
    );
  }

  return (
    <section className="space-y-10 pt-4 sm:space-y-12 sm:pt-12">
      <div className="space-y-5">
        <p className="text-sm text-fg-2">{t.welcome.label}</p>
        <h2 ref={headingRef} tabIndex={-1} className="max-w-2xl text-[clamp(2.25rem,8vw,3.75rem)] leading-[1.08] font-light outline-none">
          {t.welcome.title}
        </h2>
        <p className="max-w-xl text-lg text-fg-2">{t.welcome.intro}</p>
      </div>

      {/* A preview of the scale the test places you on; not a control. */}
      <ul aria-label={t.welcome.levelsPreview} className="flex flex-wrap gap-2">
        {LEVELS.map((l) => (
          <li key={l}>
            <LevelChip level={l} size="lg" className="min-w-14" />
          </li>
        ))}
      </ul>

      {/* The placement test is the recommended path: first, gold and largest. The other two are secondary. */}
      <div className="space-y-5">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
          <Button
            variant="primary"
            type="button"
            size="lg"
            data-welcome="test"
            aria-describedby={tagId}
            onClick={() => setStep({ kind: "test", seed: Date.now() })}
            className="min-h-16 w-full px-10 text-xl sm:w-auto"
          >
            {t.welcome.test}
          </Button>
          <span id={tagId} className={chipVariants({ tone: "neutral", size: "default" })}>
            {t.welcome.testTag}
          </span>
        </div>
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4">
          <Button type="button" variant="outline" data-welcome="choose" onClick={() => setStep({ kind: "pick" })} className="w-full sm:w-auto">
            {t.welcome.choose}
          </Button>
          <Button type="button" variant="quiet" data-welcome="skip" onClick={() => void setAll(DEFAULT_LEVEL, "skip").then(onSkip)} className="underline decoration-line-strong underline-offset-4">
            {t.welcome.skip}
          </Button>
        </div>
      </div>
    </section>
  );
}
