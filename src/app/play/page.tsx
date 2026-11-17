"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Crown, Flame, Lock, Play } from "lucide-react";
import { CATEGORY_INFO } from "@/data/rules";
import { spellingWords } from "@/data/words";
import { BOSS_STAGE, dailyId, isStageUnlocked, isWorldUnlocked, nextStageToPlay, parseStageId, stageDef, stageId, STAGES_PER_WORLD, WORLDS } from "@/domain/games/campaign";
import { LEVELS, type CefrLevel, type ProfileRecord, type StageRecord } from "@/domain/model";
import { currentStreak, dayKey } from "@/domain/progress/streak";
import { SPELLING_CATEGORIES } from "@/domain/spelling/categories";
import { useI18n } from "@/i18n";
import { useRepoQuery } from "@/repositories/provider";
import { Page, LoadingBlock, ErrorBlock } from "@/components/page";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Star } from "@/features/games/results-panel";
import { FREE_MODES, freePlayHref, type FreeMode } from "@/features/games/parse-request";
import { LevelsCard } from "@/features/levels/levels-card";
import { useLevels } from "@/features/levels/use-levels";
import { useAccount } from "@/features/account/account-provider";

/** A signed-in learner on a new device waits for the first sync before being asked for a level. */
function useFirstVisit(profile: ProfileRecord | null): boolean {
  const { user, sync, ready } = useAccount();
  if (!profile || profile.levelSource !== null || !ready) return false;
  if (user && sync?.status !== "synced" && sync?.status !== "offline" && sync?.status !== "error") return false;
  return true;
}

export default function PlayPage() {
  const { t } = useI18n();
  const router = useRouter();
  const data = useRepoQuery(async (r) => {
    const [stages, activity, due] = await Promise.all([r.games.stages(), r.activity.list(), r.words.dueCards(Date.now())]);
    return { stages, days: activity.map((a) => a.day), due: due.length };
  });
  const { profile, setArea } = useLevels();
  const firstVisit = useFirstVisit(profile.status === "ready" ? profile.data : null);
  useEffect(() => {
    if (firstVisit) router.replace("/welcome");
  }, [firstVisit, router]);

  return (
    <Page title={t.play.title} intro={t.play.intro}>
      {data.status === "loading" && <LoadingBlock label={t.common.loading} />}
      {data.status === "error" && <ErrorBlock title={t.common.errorTitle} body={t.common.errorBody} onRetry={data.reload} retryLabel={t.common.retry} />}
      {data.status === "ready" && profile.status === "ready" && !firstVisit && (
        <div className="space-y-14">
          <div className="space-y-6">
            <LevelsCard levels={profile.data.levels} onChange={setArea} />
            <Today stages={data.data.stages} days={data.data.days} due={data.data.due} />
          </div>
          <Campaign stages={data.data.stages} />
          <FreePlay level={profile.data.levels.words} onLevel={(l) => setArea("words", l)} />
        </div>
      )}
      {(firstVisit || (data.status === "ready" && profile.status === "loading")) && <LoadingBlock label={t.common.loading} />}
    </Page>
  );
}

function Today({ stages, days, due }: { stages: Readonly<Record<string, StageRecord>>; days: readonly string[]; due: number }) {
  const { t, lang } = useI18n();
  const next = nextStageToPlay(stages);
  const def = stageDef(next);
  const p = parseStageId(next);
  const today = dayKey(new Date());
  const streak = currentStreak(days, today);
  const dailyDone = (stages[dailyId(today)]?.stars ?? 0) > 0;
  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="sheet flex flex-col justify-between gap-6 p-6 sm:p-8">
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-brass">
            <Flame className="size-5" aria-hidden="true" />
            <span className="font-semibold">{t.play.streak(streak)}</span>
          </p>
          <h2 className="text-2xl font-bold sm:text-3xl">{t.play.continueAt}</h2>
          {def && p && (
            <p className="text-ink-soft">
              {def.world.name[lang]} · {def.boss ? t.play.boss : t.play.stage(p.stage)} · {typeof def.modes === "string" ? t.modes[def.modes]?.name : t.play.boss}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg" className="h-12 flex-1 gap-2 px-6 text-base sm:flex-none">
            <Link href={`/play/game?stage=${next}`}>
              <Play className="size-5" aria-hidden="true" />
              {t.play.startMode}
            </Link>
          </Button>
          {due > 0 && (
            <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base">
              <Link href="/review">{t.play.dueBadge(due)}</Link>
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-brass-fill/50 bg-brass-wash p-6 sm:p-8">
        <div className="space-y-2">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <CalendarCheck className="size-5 text-brass" aria-hidden="true" />
            {t.play.daily}
          </h2>
          <p>{dailyDone ? t.play.dailyDone : t.play.dailyIntro}</p>
        </div>
        <Button asChild size="lg" variant={dailyDone ? "outline" : "default"} className="h-12 px-6 text-base">
          <Link href="/play/game?daily=1">{dailyDone ? t.game.playAgain : t.play.dailyStart}</Link>
        </Button>
      </div>
    </section>
  );
}

function Campaign({ stages }: { stages: Readonly<Record<string, StageRecord>> }) {
  const { t, lang, num } = useI18n();
  return (
    <section aria-labelledby="campaign-h" className="space-y-6">
      <h2 id="campaign-h" className="text-2xl font-bold">
        {t.play.campaign}
      </h2>
      <ol className="space-y-5">
        {WORLDS.map((w) => {
          const open = isWorldUnlocked(w.n, stages);
          const ids = Array.from({ length: STAGES_PER_WORLD }, (_, i) => stageId(w.n, i + 1));
          const stars = ids.reduce((n, id) => n + (stages[id]?.stars ?? 0), 0);
          return (
            <li key={w.n} className="sheet space-y-4 p-5 sm:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-lg font-semibold">
                  <span className="text-ink-soft">{t.play.world(w.n)} · </span>
                  {w.name[lang]}
                </h3>
                <p className="text-sm text-ink-soft">{t.play.starsOf(stars, STAGES_PER_WORLD * 3)}</p>
              </div>
              <p className="text-sm text-hint">{w.categories.map((c) => CATEGORY_INFO[c].label[lang]).join(" · ")}</p>
              {!open && (
                <p className="flex items-center gap-2 text-sm text-ink-soft">
                  <Lock className="size-4" aria-hidden="true" />
                  {t.play.worldLocked}
                </p>
              )}
              <ol className={`grid grid-cols-5 gap-2 sm:gap-3 lg:grid-cols-10 ${open ? "" : "opacity-60"}`}>
                {ids.map((id, i) => {
                  const unlocked = isStageUnlocked(id, stages);
                  const s = stages[id]?.stars ?? 0;
                  const boss = i + 1 === BOSS_STAGE;
                  const label = `${t.play.stageLabel(w.n, i + 1)}${boss ? ` (${t.play.boss})` : ""}: ${unlocked ? t.play.stars(s) : t.play.locked}`;
                  const inner = (
                    <>
                      <span className="flex items-center gap-1 font-semibold tabular">
                        {boss && <Crown className="size-4 text-brass" aria-hidden="true" />}
                        {unlocked ? num(i + 1) : <Lock className="size-4" aria-hidden="true" />}
                      </span>
                      <span className="flex" aria-hidden="true">
                        {[0, 1, 2].map((k) => (
                          <Star key={k} index={k} filled={k < s} size={14} animate={false} />
                        ))}
                      </span>
                    </>
                  );
                  const cls = `flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border text-sm transition-colors ${
                    boss ? "border-2 border-brass-fill" : "border-rule"
                  } ${unlocked ? "bg-paper hover:border-brass-fill hover:bg-brass-wash" : "bg-muted text-ink-soft"}`;
                  return (
                    <li key={id}>
                      {unlocked ? (
                        <Link href={`/play/game?stage=${id}`} aria-label={label} className={cls}>
                          {inner}
                        </Link>
                      ) : (
                        <span role="img" aria-label={label} className={cls}>
                          {inner}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function FreePlay({ level, onLevel }: { level: CefrLevel; onLevel: (l: CefrLevel) => Promise<void> }) {
  const { t, lang, num } = useI18n();
  const categoryId = useId();
  const [category, setCategory] = useState<string>("all");
  const lvl = level;
  const cat = category === "all" ? null : category;
  const count = spellingWords.filter((w) => w.level === lvl && (cat === null || w.category === cat)).length;
  return (
    <section aria-labelledby="free-h" className="space-y-6">
      <div className="space-y-2">
        <h2 id="free-h" className="text-2xl font-bold">
          {t.play.freePlay}
        </h2>
        <p className="text-ink-soft">{t.play.freePlayIntro}</p>
      </div>
      <div className="flex flex-wrap items-end gap-6">
        <Segmented
          legend={`${t.levels.areas.words}: ${level}`}
          value={level}
          onChange={(l) => void onLevel(l)}
          options={LEVELS.map((l) => ({ value: l, label: l }))}
        />
        <div className="space-y-1.5">
          <label htmlFor={categoryId} className="block text-sm text-ink-soft">
            {t.play.category}
          </label>
          <select
            id={categoryId}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-11 w-full max-w-xs rounded-md border border-input bg-sheet px-3"
          >
            <option value="all">{t.common.all}</option>
            {SPELLING_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_INFO[c].label[lang]}
              </option>
            ))}
          </select>
        </div>
        <p className="text-sm text-ink-soft" aria-live="polite">
          {t.common.wordsN(count)}
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FREE_MODES.map((m: FreeMode) => (
          <li key={m}>
            {count === 0 ? (
              <div aria-disabled="true" className="sheet flex h-full flex-col gap-2 p-5 opacity-60">
                <span className="text-lg font-semibold">{t.modes[m]?.name}</span>
                <span className="text-ink-soft">{t.game.empty}</span>
              </div>
            ) : (
              <Link href={freePlayHref(m, lvl, cat)} className="sheet flex h-full flex-col gap-2 p-5 transition-colors hover:bg-brass-wash">
                <span className="text-lg font-semibold">{t.modes[m]?.name}</span>
                <span className="text-ink-soft">{t.modes[m]?.desc}</span>
                {m === "bee" && <span className="mt-auto text-sm text-brass">{num(60)} {t.common.seconds}</span>}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
