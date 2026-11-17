"use client";

import Link from "next/link";
import { useId } from "react";
import { Award, Lock } from "lucide-react";
import { spellingWordById } from "@/data/words";
import { CATEGORY_INFO } from "@/data/rules";
import type { SpellingCategory } from "@/data/schema";
import { ACHIEVEMENTS } from "@/domain/progress/achievements";
import { currentStreak, dayKey, longestStreak } from "@/domain/progress/streak";
import { goalProgress } from "@/domain/progress/goal";
import { levelInfo } from "@/domain/progress/levels";
import { useI18n } from "@/i18n";
import { useRepoQuery, useRepos } from "@/repositories/provider";
import { Page, LoadingBlock, ErrorBlock, EmptyBlock } from "@/components/page";
import { LineChart } from "@/components/line-chart";
import { Button } from "@/components/ui/button";
import { ACHIEVEMENT_TEXT } from "@/features/rewards/achievement-text";
import { freePlayHref } from "@/features/games/parse-request";

const GOAL_OPTIONS = [5, 10, 15, 20, 30];
const RECENT_SESSIONS = 30;
const RECENT_WRITINGS = 20;

export default function ProgressPage() {
  const { t, num, pct, date, lang } = useI18n();
  const repos = useRepos();
  const goalId = useId();
  const data = useRepoQuery(async (r) => {
    const [activity, profile, sessions, stages, due, achievements, writings] = await Promise.all([
      r.activity.list(),
      r.profile.get(),
      r.games.sessions(),
      r.games.stages(),
      r.words.dueCards(Date.now()),
      r.achievements.list(),
      r.writing.list(),
    ]);
    return { activity, profile, sessions, stages, due: due.length, achievements, writings };
  });

  if (data.status === "loading")
    return (
      <Page title={t.progress.title}>
        <LoadingBlock label={t.common.loading} />
      </Page>
    );
  if (data.status === "error")
    return (
      <Page title={t.progress.title}>
        <ErrorBlock title={t.common.errorTitle} body={t.common.errorBody} onRetry={data.reload} retryLabel={t.common.retry} />
      </Page>
    );

  const { activity, profile, sessions, stages, due, achievements, writings } = data.data;
  const today = dayKey(new Date());
  const days = activity.map((a) => a.day);
  const secondsToday = activity.filter((a) => a.day === today).reduce((s, a) => s + a.seconds, 0);
  const goal = goalProgress(secondsToday, profile.dailyGoalMinutes);
  const lvl = levelInfo(activity.reduce((s, a) => s + a.xp, 0));
  const recent = sessions.slice(-RECENT_SESSIONS);
  const answered = sessions.reduce((n, s) => n + s.items, 0);
  const correct = sessions.reduce((n, s) => n + s.correct, 0);
  const stars = Object.values(stages)
    .filter((s) => !s.id.startsWith("daily:"))
    .reduce((n, s) => n + s.stars, 0);
  const unlocked = new Map(achievements.map((a) => [a.id, a.unlockedAt]));

  // Weakest categories: words missed in recent rounds, by category.
  const misses = new Map<SpellingCategory, number>();
  for (const s of recent) {
    for (const id of s.missed) {
      const w = spellingWordById.get(id);
      if (w) misses.set(w.category, (misses.get(w.category) ?? 0) + 1);
    }
  }
  const weakest = [...misses.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <Page title={t.progress.title} intro={t.progress.intro}>
      <div className="space-y-12">
        {sessions.length === 0 && (
          <EmptyBlock
            action={
              <Button asChild size="lg" className="h-12 px-6">
                <Link href="/play/game?stage=w1-s1">{t.progress.playFirst}</Link>
              </Button>
            }
          >
            {t.progress.empty}
          </EmptyBlock>
        )}

        <section className="grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="sheet flex flex-wrap items-center gap-6 p-6">
            <GoalRing ratio={goal.ratio} />
            <div className="min-w-0 flex-1 space-y-2">
              <h2 className="font-semibold">{t.progress.goal}</h2>
              <p className="text-2xl font-semibold tabular">{goal.done ? t.progress.goalDone : t.progress.goalOf(goal.minutes, profile.dailyGoalMinutes)}</p>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <label htmlFor={goalId} className="text-ink-soft">
                  {t.progress.goalSetting}
                </label>
                <select
                  id={goalId}
                  value={profile.dailyGoalMinutes}
                  onChange={(e) => void repos.profile.save({ dailyGoalMinutes: Number(e.target.value) })}
                  className="h-11 rounded-md border border-input bg-sheet px-2"
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
            <Tile label={t.progress.streak} value={num(currentStreak(days, today))} />
            <Tile label={t.progress.longest} value={num(longestStreak(days))} />
            <Tile label={t.progress.xpLevel(lvl.level)} value={t.progress.xpProgress(lvl.xpIntoLevel, lvl.xpForNext)} small progress={lvl.progress} />
            <Tile label={t.progress.dueToday} value={num(due)} href="/review" />
          </dl>
        </section>

        <section aria-labelledby="hist-h" className="space-y-4">
          <h2 id="hist-h" className="text-xl font-semibold">
            {t.progress.history}
          </h2>
          {recent.length < 2 ? (
            <p className="rounded-xl border border-dashed border-rule-strong p-6 text-ink-soft">{t.progress.emptyChart}</p>
          ) : (
            <LineChart
              values={recent.map((s) => (s.items === 0 ? 0 : Math.round((s.correct / s.items) * 100)))}
              label={t.progress.historyLabel(recent.length)}
              formatY={(n) => pct(Math.round(n))}
              className="sheet p-4"
              height={200}
            />
          )}
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Tile label={t.progress.wordsCorrect} value={num(correct)} />
            <Tile label={t.progress.accuracy} value={answered === 0 ? "–" : pct(Math.round((correct / answered) * 100))} />
            <Tile label={t.progress.games} value={num(sessions.length)} />
            <Tile label={t.progress.stars} value={num(stars)} />
          </dl>
        </section>

        <section aria-labelledby="writ-h" className="space-y-4">
          <h2 id="writ-h" className="text-xl font-semibold">
            {t.writing.history}
          </h2>
          {writings.length === 0 ? (
            <p className="rounded-xl border border-dashed border-rule-strong p-6 text-ink-soft">
              {t.writing.historyEmpty}{" "}
              <Link href="/write" className="font-medium text-brass underline underline-offset-4">
                {t.writing.title}
              </Link>
            </p>
          ) : (
            <ul className="space-y-3">
              {writings.slice(0, RECENT_WRITINGS).map((w) => (
                <li key={w.id}>
                  <details className="sheet group p-4">
                    <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-semibold">{t.writing.modeNames[w.mode]}</span>
                      <span className="rounded-full border border-rule px-2 py-0.5 text-sm tabular">{w.level}</span>
                      <span className="text-sm text-ink-soft">{t.writing.historyItem(w.words, pct(Math.round(w.accuracy * 100)))}</span>
                      <span className="ms-auto text-sm text-ink-soft">{date(w.at)}</span>
                    </summary>
                    <p dir="ltr" lang="en" className="mt-3 font-mono whitespace-pre-wrap break-words">
                      {w.text}
                    </p>
                    {w.missed.length > 0 && (
                      <ul className="mt-3 flex flex-wrap gap-2" dir="ltr" lang="en">
                        {w.missed.map((m) => (
                          <li key={`${m.wrong}-${m.right ?? ""}`} className="rounded-full border border-rule px-3 py-1 text-sm">
                            <span className="text-error line-through">{m.wrong}</span> <span className="font-mono text-correct">{m.right ?? "?"}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </details>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="weak-h" className="space-y-4">
          <h2 id="weak-h" className="text-xl font-semibold">
            {t.progress.weakest}
          </h2>
          {weakest.length === 0 ? (
            <p className="text-ink-soft">{t.progress.weakestEmpty}</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-3">
              {weakest.map(([cat, n]) => (
                <li key={cat} className="sheet flex flex-col gap-3 p-4">
                  <p className="font-semibold">{CATEGORY_INFO[cat].label[lang]}</p>
                  <p className="text-sm text-ink-soft">{t.common.wordsN(n)}</p>
                  <Button asChild variant="outline" className="mt-auto h-11">
                    <Link href={freePlayHref("listen", null, cat)}>{t.progress.practise}</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="achievements" aria-labelledby="ach-h" className="scroll-mt-24 space-y-4">
          <h2 id="ach-h" className="text-xl font-semibold">
            {t.progress.achievements}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ACHIEVEMENTS.map((a) => {
              const at = unlocked.get(a.id);
              const text = ACHIEVEMENT_TEXT[a.id]?.[lang];
              return (
                <li key={a.id} className={`flex items-start gap-3 rounded-xl border p-4 ${at ? "border-brass-fill/60 bg-brass-wash" : "border-rule"}`}>
                  {at ? <Award className="mt-0.5 size-5 shrink-0 text-brass" aria-hidden="true" /> : <Lock className="mt-0.5 size-5 shrink-0 text-ink-soft" aria-hidden="true" />}
                  <div>
                    <p className="font-semibold">{text?.title ?? a.id}</p>
                    <p className="text-sm text-ink-soft">{text?.body}</p>
                    <p className="mt-1 text-xs text-ink-soft">{at ? t.progress.unlocked(date(at)) : t.progress.locked}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </Page>
  );
}

function Tile({ label, value, small, progress, href }: { label: string; value: string; small?: boolean; progress?: number; href?: string }) {
  const body = (
    <>
      <dt className="text-sm text-ink-soft">{label}</dt>
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
