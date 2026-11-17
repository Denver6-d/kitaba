"use client";

import { useCallback, useMemo, useState } from "react";
import type { Level } from "@/data/schema";
import { sentences } from "@/data/sentences";
import type { GradeResult } from "@/domain/sentences/grader";
import { hintLevel, nextMastery } from "@/domain/progress/hints";
import { xpFor } from "@/domain/progress/levels";
import { seededRng, shuffle } from "@/domain/shared/random";
import { useI18n } from "@/i18n";
import { useRepoQuery, useRepos } from "@/repositories/provider";
import { useClientSeed } from "@/lib/use-hydrated";
import { Page, LoadingBlock } from "@/components/page";
import { Segmented } from "@/components/segmented";
import { SentenceCard } from "@/features/sentences/sentence-card";
import { useAchievementCheck } from "@/features/rewards/use-achievement-check";

type LevelFilter = Level | "all";
const SECONDS_PER_SENTENCE = 45;

export default function SentencesPage() {
  const { t, num } = useI18n();
  const repos = useRepos();
  const seed = useClientSeed();
  const checkAchievements = useAchievementCheck();
  const mastery = useRepoQuery((r) => r.sentences.allMastery());
  const profile = useRepoQuery((r) => r.profile.get());
  const [filter, setFilter] = useState<LevelFilter | null>(null);
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(0);
  const [saveFailed, setSaveFailed] = useState(false);
  // Mastery changed during this session (the stored map is only read once, for ordering).
  const [sessionMastery, setSessionMastery] = useState<Record<string, number>>({});

  // Default filter: the learner's diagnostic level (or all).
  const level: LevelFilter = filter ?? (profile.status === "ready" ? (profile.data.level ?? "all") : "all");

  // Order is fixed when the filter changes: least-practised sentences first, shuffled within a tier.
  const order = useMemo(() => {
    // Wait for the profile too, so the default level does not flip and remount the card.
    if (mastery.status !== "ready" || profile.status === "loading") return null;
    const pool = sentences.filter((s) => level === "all" || s.level === level);
    const m = mastery.data;
    const tier = (id: string) => Math.min(3, m[`sentence:${id}`] ?? 0);
    return shuffle(pool, seededRng(seed + level.length)).sort((a, b) => tier(a.id) - tier(b.id));
    // Re-ordering on every mastery change would move the sentence the learner is answering.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, seed, mastery.status, profile.status]);

  const current = order ? order[index % order.length] : undefined;
  const key = current ? `sentence:${current.id}` : "";
  const m = sessionMastery[key] ?? (mastery.status === "ready" ? (mastery.data[key] ?? 0) : 0);

  const onGraded = useCallback(
    async (r: GradeResult, input: string) => {
      if (!current) return;
      setDone((d) => d + 1);
      await repos.sentences.saveAttempt({ sentenceId: current.id, input, score: r.score, errors: r.errors.map((e) => e.type), at: Date.now() });
      const next = nextMastery(m, r.correct);
      setSessionMastery((prev) => ({ ...prev, [key]: next }));
      await repos.sentences.setMastery(key, next);
      await repos.activity.log("sentence", SECONDS_PER_SENTENCE, xpFor({ kind: "sentence", score: r.score }));
      await checkAchievements();
    },
    [current, key, m, repos, checkAchievements],
  );

  return (
    <Page title={t.sentences.title} intro={t.sentences.intro} width="narrow">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Segmented
            legend={t.sentences.filter}
            value={level}
            onChange={(v) => {
              setFilter(v);
              setIndex(0);
            }}
            options={[
              { value: "all", label: t.spelling.all },
              { value: "A1", label: "A1" },
              { value: "A2", label: "A2" },
              { value: "B1", label: "B1" },
            ]}
          />
          <p className="text-sm text-ink-soft tabular">{t.sentences.progress(done, order?.length ?? 0).replace(/\d+/g, (d) => num(Number(d)))}</p>
        </div>
        {current ? (
          <SentenceCard key={`${current.id}-${index}`} sentence={current} hint={hintLevel(m)} onGraded={(r, i) => {
              onGraded(r, i).catch(() => setSaveFailed(true));
            }} onNext={() => setIndex((i) => i + 1)} />
        ) : (
          <LoadingBlock label={t.common.loading} />
        )}
        {saveFailed && (
          <p role="alert" className="text-sm text-error">
            {t.results.saveFailed}
          </p>
        )}
        <p className="text-xs text-ink-soft">{t.sentences.heuristic}</p>
      </div>
    </Page>
  );
}
