"use client";

import Link from "next/link";
import { errorRate, weakestKeys } from "@/domain/typing/key-stats";
import { lessons } from "@/data/lessons";
import { useI18n } from "@/i18n";
import { useRepoQuery } from "@/repositories/provider";
import { Page, LoadingBlock, ErrorBlock, EmptyBlock } from "@/components/page";
import { KeyboardSvg } from "@/features/keyboard/keyboard-svg";
import { Button } from "@/components/ui/button";

export default function LearnPage() {
  const { t, lang, pct } = useI18n();
  const stats = useRepoQuery((r) => r.progress.keyStats());
  const mastery = useRepoQuery((r) => r.sentences.allMastery());

  const weak = stats.status === "ready" ? weakestKeys(stats.data, 5) : [];
  const hasStats = stats.status === "ready" && Object.keys(stats.data).length > 0;

  return (
    <Page title={t.learn.title} intro={t.learn.intro}>
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section aria-labelledby="lessons-h" className="space-y-4">
          <h2 id="lessons-h" className="text-xl font-semibold">
            {t.learn.lessons}
          </h2>
          <ol className="divide-y divide-rule border-y border-rule">
            {lessons.map((l) => {
              const done = mastery.status === "ready" && (mastery.data[`lesson:${l.id}`] ?? 0) > 0;
              return (
                <li key={l.id} className="flex flex-wrap items-center gap-4 py-4">
                  <span
                    aria-hidden="true"
                    className={`grid size-9 shrink-0 place-items-center rounded-full border text-sm tabular ${done ? "border-correct bg-[var(--correct-wash)] text-correct" : "border-rule-strong text-ink-soft"}`}
                  >
                    {l.order}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{lang === "ar" ? l.titleAr : l.titleEn}</p>
                    <p className="text-sm text-ink-soft">
                      {t.learn.lessonKeys}:{" "}
                      <span dir="ltr" className="font-mono">
                        {l.keys}
                      </span>
                      {done && <span className="ms-2 text-correct">· {t.learn.lessonDone}</span>}
                    </p>
                  </div>
                  <Button asChild variant={done ? "outline" : "default"} className="h-9">
                    <Link href={`/learn/lesson/${l.id}`}>{t.learn.startLesson}</Link>
                  </Button>
                </li>
              );
            })}
          </ol>

          <div className="mt-8 rounded-xl border border-rule p-5">
            <h2 className="font-semibold">{t.learn.custom}</h2>
            <p className="mt-1 text-sm text-ink-soft">{t.learn.customIntro}</p>
            <Button asChild variant="outline" className="mt-3 h-9">
              <Link href="/custom">{t.custom.title}</Link>
            </Button>
          </div>
        </section>

        <aside className="space-y-10">
          <section aria-labelledby="heat-h" className="space-y-3">
            <h2 id="heat-h" className="text-xl font-semibold">
              {t.learn.heatmap}
            </h2>
            {stats.status === "loading" && <LoadingBlock label={t.common.loading} />}
            {stats.status === "error" && <ErrorBlock title={t.common.errorTitle} body={t.common.errorBody} onRetry={stats.reload} retryLabel={t.common.retry} />}
            {stats.status === "ready" &&
              (hasStats ? (
                <>
                  <p className="text-sm text-ink-soft">{t.learn.heatmapIntro}</p>
                  <KeyboardSvg stats={stats.data} label={t.learn.heatmap} className="sheet p-3" />
                  <div className="flex items-center gap-2 text-xs text-ink-soft" aria-hidden="true">
                    <span>{t.learn.legendLow}</span>
                    <span className="h-2 w-24 rounded-full bg-gradient-to-r from-[var(--key)] to-[var(--error)] ring-1 ring-rule rtl:bg-gradient-to-l" />
                    <span>{t.learn.legendHigh}</span>
                  </div>
                  <ul className="sr-only">
                    {Object.entries(stats.data)
                      .filter(([, s]) => s.hits + s.misses >= 3)
                      .sort(([, a], [, b]) => errorRate(b) - errorRate(a))
                      .slice(0, 10)
                      .map(([k, s]) => (
                        <li key={k}>{t.learn.keyLabel(k === " " ? "Space" : k, Math.round(errorRate(s) * 100), s.hits + s.misses)}</li>
                      ))}
                  </ul>
                </>
              ) : (
                <EmptyBlock action={<Button asChild className="h-9"><Link href="/practice">{t.nav.practice}</Link></Button>}>{t.learn.heatmapEmpty}</EmptyBlock>
              ))}
          </section>

          <section aria-labelledby="drill-h" className="space-y-3">
            <h2 id="drill-h" className="text-xl font-semibold">
              {t.learn.adaptive}
            </h2>
            {weak.length > 0 ? (
              <>
                <p className="text-sm text-ink-soft">{t.learn.adaptiveIntro("")}</p>
                <p dir="ltr" className="flex flex-wrap gap-1.5">
                  {weak.map((k) => {
                    const s = stats.status === "ready" ? stats.data[k] : undefined;
                    return (
                      <kbd key={k} className="rounded-md border border-error/40 bg-[var(--error-wash)] px-2 py-1 font-mono text-sm" title={s ? pct(errorRate(s) * 100) : undefined}>
                        {k}
                      </kbd>
                    );
                  })}
                </p>
                <Button asChild className="h-10">
                  <Link href="/learn/drill">{t.learn.startDrill}</Link>
                </Button>
              </>
            ) : (
              <p className="text-sm text-ink-soft">{t.learn.adaptiveEmpty}</p>
            )}
          </section>
        </aside>
      </div>
    </Page>
  );
}
