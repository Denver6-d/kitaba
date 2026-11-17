"use client";

import { useId, useState } from "react";
import { Printer } from "lucide-react";
import { levelInfo } from "@/domain/progress/levels";
import { useI18n } from "@/i18n";
import { useRepoQuery } from "@/repositories/provider";
import { Page, LoadingBlock } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shell/logo";
import "./print.css";

/** Printable progress certificate (print CSS only, no PDF library). The name never leaves the page. */
export default function CertificatePage() {
  const { t, num, pct, date } = useI18n();
  const [name, setName] = useState("");
  const nameId = useId();
  const data = useRepoQuery(async (r) => {
    const [results, activity, attempts, achievements, profile, bests] = await Promise.all([
      r.progress.listResults(),
      r.activity.list(),
      r.sentences.attempts(),
      r.achievements.list(),
      r.profile.get(),
      r.progress.personalBests(),
    ]);
    const timed = results.filter((x) => x.duration > 0);
    return {
      best: Math.max(0, ...Object.values(bests).map((b) => b.wpm)),
      accuracy: timed.length ? timed.slice(-10).reduce((s, x) => s + x.accuracy, 0) / Math.min(10, timed.length) : 0,
      minutes: Math.round(activity.reduce((s, a) => s + a.seconds, 0) / 60),
      sentences: attempts.filter((a) => a.score === 1).length,
      achievements: achievements.length,
      level: profile.level,
      practiceLevel: levelInfo(activity.reduce((s, a) => s + a.xp, 0)).level,
      empty: activity.length === 0,
      today: Date.now(),
    };
  });

  return (
    <Page title={t.certificate.title} width="wide">
      <div className="no-print mb-8 flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <label htmlFor={nameId} className="block text-sm font-medium">
            {t.certificate.namePlaceholder}
          </label>
          <input
            id={nameId}
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 60))}
            className="h-11 w-72 max-w-full rounded-lg border border-input bg-sheet px-3"
            autoComplete="name"
          />
        </div>
        <Button size="lg" className="h-11 gap-2" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden="true" />
          {t.certificate.print}
        </Button>
      </div>

      {data.status !== "ready" ? (
        <LoadingBlock label={t.common.loading} />
      ) : (
        <article className="certificate sheet relative mx-auto aspect-[1.414] w-full max-w-4xl overflow-hidden p-[6%]">
          <div className="pointer-events-none absolute inset-[3%] rounded-xl border border-brass-fill/60" aria-hidden="true" />
          <div className="relative flex h-full flex-col">
            <Logo />
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
              <h2 className="text-3xl font-bold sm:text-4xl">{t.certificate.title}</h2>
              <p className="text-ink-soft">{t.certificate.awardedTo}</p>
              <p className="min-h-12 border-b-2 border-brass-fill px-8 text-3xl font-semibold sm:text-4xl">{name || " "}</p>
              <p className="max-w-lg text-ink-soft">{t.certificate.body}</p>
              {data.data.empty ? (
                <p className="text-sm text-ink-soft">{t.certificate.empty}</p>
              ) : (
                <dl className="mt-4 grid grid-cols-2 gap-x-10 gap-y-3 text-sm sm:grid-cols-3">
                  <Fact label={t.stats.best} value={`${num(Math.round(data.data.best))} ${t.common.wpmShort}`} />
                  <Fact label={t.stats.avgAccuracy} value={pct(data.data.accuracy, 1)} />
                  <Fact label={t.certificate.minutes} value={num(data.data.minutes)} />
                  <Fact label={t.stats.sentencesDone} value={num(data.data.sentences)} />
                  <Fact label={t.achievements.title} value={num(data.data.achievements)} />
                  <Fact label={t.stats.cefr} value={data.data.level ?? t.stats.cefrNone} />
                </dl>
              )}
            </div>
            <div className="flex items-end justify-between gap-4 text-xs text-ink-soft">
              <span>
                {t.certificate.date}: {date(data.data.today)}
              </span>
              <span className="max-w-sm text-end">{t.certificate.disclaimer}</span>
            </div>
          </div>
        </article>
      )}
    </Page>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-ink-soft">{label}</dt>
      <dd className="text-lg font-semibold tabular">{value}</dd>
    </div>
  );
}
