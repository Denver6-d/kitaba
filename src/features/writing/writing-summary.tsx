"use client";

import { useEffect } from "react";
import type { MistakeType } from "@/domain/writing/classify";
import type { WritingSummary } from "@/domain/writing/summary";
import { useI18n } from "@/i18n";
import { useSettings } from "@/lib/settings-store";
import { giveFeedback } from "@/lib/feedback";
import { AnimatedNumber } from "@/components/animated-number";
import { Star } from "@/features/games/results-panel";
import { addedToReview, type SavedWriting } from "./use-save-writing";

/**
 * End-of-text summary with the same celebration as a cleared stage (DESIGN
 * "game feel"): stars draw in, the XP counts up, a soft tone if sounds are on.
 */
export function WritingSummaryPanel({ summary, saved, saveFailed }: { summary: WritingSummary; saved: SavedWriting | null; saveFailed: boolean }) {
  const { t, num, pct } = useI18n();
  const [settings] = useSettings();
  useEffect(() => {
    if (summary.stars > 0) giveFeedback("cleared", settings);
    // Once per result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary]);
  const headline = summary.stars === 3 ? t.writing.great : summary.stars > 0 ? t.writing.good : t.writing.keepGoing;
  const types = Object.entries(summary.byType) as [MistakeType, number][];
  const added = saved ? addedToReview(summary.practice, saved.reviewed) : 0;

  return (
    <section aria-labelledby="w-sum" className="panel space-y-6 p-5 sm:p-8">
      <div className="space-y-3 text-center">
        <h2 id="w-sum" className="text-2xl font-light">
          {headline}
        </h2>
        <div className="flex items-end justify-center gap-3" role="img" aria-label={t.play.stars(summary.stars)}>
          {[0, 1, 2].map((i) => (
            <Star key={i} index={i} filled={i < summary.stars} size={i === 1 ? 52 : 40} />
          ))}
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl border border-line p-3">
          <dt className="text-sm text-fg-2">{t.writing.accuracy}</dt>
          <dd className="mt-1 font-latin text-2xl font-medium tabular sm:text-3xl">{pct(Math.round(summary.accuracy * 100))}</dd>
        </div>
        <div className="rounded-xl border border-line p-3">
          <dt className="text-sm text-fg-2">{t.writing.mistakesLabel}</dt>
          <dd className="mt-1 font-latin text-2xl font-medium tabular sm:text-3xl">
            {num(summary.mistakes)} / {num(summary.words)}
          </dd>
        </div>
        <div className="rounded-xl border border-line p-3">
          <dt className="text-sm text-fg-2">XP</dt>
          <dd className="mt-1 font-latin text-2xl font-medium text-fg tabular sm:text-3xl">
            <AnimatedNumber value={summary.xp} format={(n) => `+${num(Math.round(n))}`} />
          </dd>
        </div>
      </dl>
      {saved?.levelUp != null && <p className="text-center font-semibold text-fg">{t.game.levelUp(saved.levelUp)}</p>}

      {types.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold">{t.writing.byType}</h3>
          <ul className="space-y-2">
            {types.map(([type, n]) => (
              <li key={type} className="flex gap-3 text-sm">
                <span className="shrink-0 rounded-full bg-error-tint px-2.5 py-0.5 font-semibold text-error tabular">{num(n)}</span>
                <span className="text-fg-2">{t.writing.types[type]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.practice.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold">{t.writing.practise}</h3>
          <ul className="flex flex-wrap gap-2" dir="ltr" lang="en">
            {summary.practice.map((p) => (
              <li key={p.right.toLowerCase()} className="rounded-full border border-line px-3 py-1.5 font-word">
                {p.right}
              </li>
            ))}
          </ul>
          {added > 0 && <p className="text-sm text-fg">{t.writing.toReview(added)}</p>}
        </div>
      )}

      {summary.unmatched.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold">{t.writing.unmatched}</h3>
          <p className="text-sm text-fg-2">{t.writing.unmatchedBody}</p>
          <ul className="flex flex-wrap gap-2" dir="ltr" lang="en">
            {summary.unmatched.map((m) => (
              <li key={m.wrong.toLowerCase()} className="rounded-full border border-dashed border-line-strong px-3 py-1.5 font-word text-error line-through">
                {m.wrong}
              </li>
            ))}
          </ul>
        </div>
      )}
      {saveFailed && <p className="rounded-lg bg-error-tint p-3 text-sm text-error">{t.game.saveFailed}</p>}
    </section>
  );
}
