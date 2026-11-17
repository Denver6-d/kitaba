"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { keyStatsFromLog, weakestKeys } from "@/domain/typing/key-stats";
import { PB_MIN_ACCURACY } from "@/domain/typing/personal-best";
import { useI18n } from "@/i18n";
import { AnimatedNumber } from "@/components/animated-number";
import { LineChart } from "@/components/line-chart";
import { Button } from "@/components/ui/button";
import type { SaveTestOutcome } from "@/repositories/types";
import type { FinishedSession } from "./use-typing-session";
import { ShareResultButton } from "@/features/rewards/share-result";

interface Props {
  readonly session: FinishedSession;
  readonly outcome: SaveTestOutcome | null;
  readonly onAgain: () => void;
  readonly modeLabel: string;
  readonly saveFailed?: boolean;
}

export function ResultsPanel({ session, outcome, onAgain, modeLabel, saveFailed = false }: Props) {
  const { t, num, pct } = useI18n();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { metrics, state } = session;
  const weak = weakestKeys(keyStatsFromLog(state.log), 3).filter((k) => k !== " ");
  const isBest = outcome?.isNewBest === true;

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section aria-labelledby="results-heading" className="space-y-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="results-heading" ref={headingRef} tabIndex={-1} className="text-2xl font-semibold outline-none">
          {t.results.title}
          <span className="ms-3 text-base font-normal text-ink-soft">{modeLabel}</span>
        </h2>
      </div>

      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="space-y-6">
          <div>
            <p className="text-sm text-ink-soft">{t.common.wpm}</p>
            <p className="font-latin-display text-7xl leading-none font-medium tabular">
              <bdi>
                <AnimatedNumber value={Math.round(metrics.netWpm)} format={(n) => num(Math.round(n))} />
              </bdi>
            </p>
            {/* The personal-best moment: a brass rule draws itself under the number. */}
            <div className="mt-3 h-[3px] w-full max-w-[12rem] overflow-hidden rounded-full bg-rule">
              <div
                className={`h-full origin-left rounded-full rtl:origin-right bg-brass-fill ${isBest ? "animate-[rule-draw_700ms_cubic-bezier(.2,.7,.2,1)_both]" : "scale-x-0"}`}
              />
            </div>
            <p className="mt-2 min-h-6 text-sm" role="status">
              {outcome === null
                ? null
                : isBest
                  ? <strong className="text-brass">{t.results.newBest}</strong>
                  : metrics.accuracy < PB_MIN_ACCURACY
                    ? <span className="text-ink-soft">{t.results.lowAccuracy}</span>
                    : outcome.previousBest !== null
                      ? <span className="text-ink-soft">{t.results.previousBest(Math.round(outcome.previousBest))}</span>
                      : null}
              {isBest && outcome?.previousBest === null ? <span className="ms-2 text-ink-soft">{t.results.firstBest}</span> : null}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 tabular">
            <Stat label={t.common.accuracy} value={<AnimatedNumber value={metrics.accuracy} format={(n) => pct(n, 1)} />} />
            <Stat label={t.common.consistency} value={<AnimatedNumber value={metrics.consistency} format={(n) => pct(n)} />} />
            <Stat label={t.results.raw} value={`${num(Math.round(metrics.rawWpm))} ${t.common.wpmShort}`} />
            <Stat label={t.results.errors} value={num(metrics.errors)} />
          </dl>
          {saveFailed && (
            <p role="alert" className="rounded-lg bg-[var(--error-wash)] p-3 text-sm text-error">
              {t.results.saveFailed}
            </p>
          )}
          {state.layoutMismatches > 0 && <p className="text-sm text-ink-soft">{t.results.layoutNote(state.layoutMismatches)}</p>}
        </div>

        <div className="space-y-4">
          {metrics.samples.length > 1 && (
            <LineChart values={metrics.samples} label={t.results.chartLabel} reference={metrics.netWpm} className="sheet p-3" />
          )}
          {weak.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-ink-soft">{t.results.weakKeys}:</span>
              <span dir="ltr" className="flex gap-1.5">
                {weak.map((k) => (
                  <kbd key={k} className="min-w-8 rounded-md border border-rule bg-sheet px-2 py-1 text-center font-mono">
                    {k}
                  </kbd>
                ))}
              </span>
              <Link href={`/learn/drill?keys=${encodeURIComponent(weak.join(""))}`} className="font-medium text-brass underline-offset-4 hover:underline">
                {t.results.drillThem}
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button size="lg" onClick={onAgain} className="h-11 px-5">
          {t.results.again}
        </Button>
        <ShareResultButton wpm={Math.round(metrics.netWpm)} accuracy={metrics.accuracy} mode={modeLabel} />
        <Button asChild variant="outline" size="lg" className="h-11 px-5">
          <Link href="/stats">{t.results.stats}</Link>
        </Button>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className="text-xl font-semibold">{value}</dd>
    </div>
  );
}
