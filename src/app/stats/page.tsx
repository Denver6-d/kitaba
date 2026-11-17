"use client";

import Link from "next/link";
import { useId } from "react";
import { currentStreak, dayKey, longestStreak } from "@/domain/progress/streak";
import { goalProgress } from "@/domain/progress/goal";
import { levelInfo } from "@/domain/progress/levels";
import { useI18n } from "@/i18n";
import { useRepoQuery, useRepos } from "@/repositories/provider";
import { Page, LoadingBlock, ErrorBlock, EmptyBlock } from "@/components/page";
import { LineChart } from "@/components/line-chart";
import { Button } from "@/components/ui/button";
import { DiagnosticBanner } from "@/features/progress/diagnostic-banner";

const GOAL_OPTIONS = [5, 10, 15, 20, 30];

export default function StatsPage() {
  const { t, num, pct, date } = useI18n();
  const repos = useRepos();
  const goalId = useId();
  const data = useRepoQuery(async (r) => {
    const [results, activity, profile, bests, due, attempts] = await Promise.all([
      r.progress.listResults(),
      r.activity.list(),
      r.profile.get(),
      r.progress.personalBests(),
      r.words.dueCards(Date.now()),
      r.sentences.attempts(),
    ]);
    return { results, activity, profile, bests, due: due.length, attempts: attempts.length };
  });

  if (data.status === "loading") return <Page title={t.stats.title}><LoadingBlock label={t.common.loading} /></Page>;
  if (data.status === "error")
    return (
      <Page title={t.stats.title}>
        <ErrorBlock title={t.common.errorTitle} body={t.common.errorBody} onRetry={data.reload} retryLabel={t.common.retry} />
      </Page>
    );

  const { results, activity, profile, bests, due, attempts } = data.data;
  const timed = results.filter((r) => r.duration > 0);
  const recent = timed.slice(-30);
  const last10 = timed.slice(-10);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const today = dayKey(new Date());
  const days = activity.map((a) => a.day);
  const secondsToday = activity.filter((a) => a.day === today).reduce((s, a) => s + a.seconds, 0);
  const goal = goalProgress(secondsToday, profile.dailyGoalMinutes);
  const xp = activity.reduce((s, a) => s + a.xp, 0);
  const lvl = levelInfo(xp);
  const bestOverall = Math.max(0, ...Object.values(bests).map((b) => b.wpm));

  return (
    <Page title={t.stats.title}>
      <div className="space-y-12">
        {profile.diagnosticAt === null && <DiagnosticBanner />}

        {/* Today: goal ring + streak, the two things to act on. */}
        <section className="grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="sheet flex flex-wrap items-center gap-6 p-6">
            <GoalRing ratio={goal.ratio} />
            <div className="min-w-0 flex-1 space-y-2">
              <h2 className="font-semibold">{t.stats.goal}</h2>
              <p className="text-2xl font-semibold tabular">{goal.done ? t.stats.goalDone : t.stats.goalOf(goal.minutes, profile.dailyGoalMinutes)}</p>
              <div className="flex items-center gap-2 text-sm">
                <label htmlFor={goalId} className="text-ink-soft">
                  {t.stats.goalSetting}
                </label>
                <select
                  id={goalId}
                  value={profile.dailyGoalMinutes}
                  onChange={(e) => void repos.profile.save({ dailyGoalMinutes: Number(e.target.value) })}
                  className="h-9 rounded-md border border-input bg-sheet px-2"
                >
                  {GOAL_OPTIONS.map((g) => (
                    <option key={g} value={g}>
                      {num(g)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-4">
            <Tile label={t.stats.streak} value={num(currentStreak(days, today))} />
            <Tile label={t.stats.longest} value={num(longestStreak(days))} />
            <Tile label={t.stats.xpLevel(lvl.level)} value={t.stats.xpProgress(lvl.xpIntoLevel, lvl.xpForNext)} small progress={lvl.progress} />
            <Tile label={t.stats.cefr} value={profile.level ?? t.stats.cefrNone} />
          </dl>
        </section>

        <section aria-labelledby="hist-h" className="space-y-4">
          <h2 id="hist-h" className="text-xl font-semibold">
            {t.stats.history}
          </h2>
          {recent.length === 0 ? (
            <EmptyBlock action={<Button asChild className="h-9"><Link href="/practice">{t.nav.practice}</Link></Button>}>{t.stats.empty}</EmptyBlock>
          ) : (
            <>
              <LineChart values={recent.map((r) => r.wpm)} label={t.stats.historyLabel(recent.length)} reference={avg(last10.map((r) => r.wpm))} className="sheet p-4" height={200} />
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Tile label={t.stats.best} value={`${num(Math.round(bestOverall))} ${t.common.wpmShort}`} />
                <Tile label={t.stats.average} value={`${num(Math.round(avg(last10.map((r) => r.wpm))))} ${t.common.wpmShort}`} />
                <Tile label={t.stats.avgAccuracy} value={pct(avg(last10.map((r) => r.accuracy)), 1)} />
                <Tile label={t.stats.tests} value={num(timed.length)} />
              </dl>
            </>
          )}
        </section>

        <section className="grid gap-8 md:grid-cols-2">
          <div className="space-y-3">
            <h2 className="text-xl font-semibold">{t.stats.bests}</h2>
            {Object.keys(bests).length === 0 ? (
              <p className="text-sm text-ink-soft">{t.stats.empty}</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-rule text-ink-soft">
                    <th scope="col" className="py-2 text-start font-normal">{t.stats.mode}</th>
                    <th scope="col" className="py-2 text-start font-normal">{t.common.wpmShort}</th>
                    <th scope="col" className="py-2 text-start font-normal">{t.common.accuracy}</th>
                    <th scope="col" className="py-2 text-start font-normal">{t.leaderboard.date}</th>
                  </tr>
                </thead>
                <tbody className="tabular">
                  {Object.values(bests)
                    .sort((a, b) => b.wpm - a.wpm)
                    .map((b) => {
                      const [src, dur] = b.modeKey.split(":");
                      const label = t.test.sources[src as keyof typeof t.test.sources] ?? src;
                      return (
                        <tr key={b.modeKey} className="border-b border-rule/60">
                          <td className="py-2">
                            {label}
                            {dur && dur !== "0" ? ` · ${num(Number(dur))} ${t.common.seconds}` : ""}
                          </td>
                          <td className="py-2 font-semibold">{num(Math.round(b.wpm))}</td>
                          <td className="py-2">{pct(b.accuracy)}</td>
                          <td className="py-2 text-ink-soft">{date(b.at)}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            )}
          </div>
          <dl className="grid h-fit grid-cols-2 gap-4">
            <Tile label={t.stats.spellingDue} value={num(due)} href="/spelling/review" />
            <Tile label={t.stats.sentencesDone} value={num(attempts)} href="/sentences" />
          </dl>
        </section>
      </div>
    </Page>
  );
}

function Tile({ label, value, small, progress, href }: { label: string; value: string; small?: boolean; progress?: number; href?: string }) {
  const body = (
    <>
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className={`mt-1 font-semibold tabular ${small ? "text-base" : "text-2xl"}`}>{value}</dd>
      {progress !== undefined && (
        <div className="mt-2 h-1 rounded-full bg-rule" aria-hidden="true">
          <div className="h-full rounded-full bg-brass-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
    </>
  );
  return href ? (
    <Link href={href} className="block rounded-xl border border-rule p-4 transition-colors hover:border-rule-strong">
      {body}
    </Link>
  ) : (
    <div className="rounded-xl border border-rule p-4">{body}</div>
  );
}

function GoalRing({ ratio }: { ratio: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 72 72" className="size-20 shrink-0 -rotate-90" aria-hidden="true">
      <circle cx="36" cy="36" r={r} fill="none" stroke="var(--rule)" strokeWidth="6" />
      <circle cx="36" cy="36" r={r} fill="none" stroke="var(--brass-fill)" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${c * ratio} ${c}`} />
    </svg>
  );
}
