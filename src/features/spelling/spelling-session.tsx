"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type { SpellingWord } from "@/data/schema";
import { applyAnswer, daysUntil, qualityFor } from "@/domain/spelling/srs";
import { hintLevel, nextMastery } from "@/domain/progress/hints";
import { xpFor } from "@/domain/progress/levels";
import { useI18n } from "@/i18n";
import { useRepoQuery, useRepos } from "@/repositories/provider";
import { Button } from "@/components/ui/button";
import { useAchievementCheck } from "@/features/rewards/use-achievement-check";
import { DictationCard, type DictationAnswer } from "./dictation-card";

/** A dictation item takes roughly 15 seconds; used for the daily-goal minutes. */
const SECONDS_PER_WORD = 15;

/**
 * A run through a list of words. The SM-2 rules live in domain/spelling/srs.ts
 * (applyAnswer): misses create or lapse a card, due cards are reviewed, and
 * early practice never inflates an interval.
 */
export function SpellingSession({ words, onDone }: { words: readonly SpellingWord[]; onDone?: () => void }) {
  const { t, num } = useI18n();
  const repos = useRepos();
  const checkAchievements = useAchievementCheck();
  const mastery = useRepoQuery((r) => r.sentences.allMastery());
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  // Keyed by word so a slow save can never label the next word.
  const [nextReview, setNextReview] = useState<{ wordId: string; days: number } | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  const word = words[index];

  const onAnswer = useCallback(
    async (w: SpellingWord, a: DictationAnswer) => {
      const now = Date.now();
      if (a.correct) setCorrect((c) => c + 1);
      const existing = await repos.words.card(w.id);
      const next = applyAnswer(existing, w.id, qualityFor({ ...a, word: w.word }), now);
      if (next) {
        await repos.words.saveCard(next);
        setNextReview({ wordId: w.id, days: daysUntil(next.due, now) });
      }
      const key = `spell:${w.id}`;
      await repos.sentences.setMastery(key, nextMastery(mastery.status === "ready" ? (mastery.data[key] ?? 0) : 0, a.correct && !a.revealed));
      await repos.activity.log("spelling", SECONDS_PER_WORD, xpFor({ kind: "spelling", correct: a.correct }));
      await checkAchievements();
    },
    [repos, mastery, checkAchievements],
  );

  if (!word) {
    return (
      <div className="sheet space-y-4 p-8 text-center" role="status">
        <p className="text-xl font-semibold">{t.spelling.sessionDone(correct, words.length)}</p>
        <div className="flex flex-wrap justify-center gap-3">
          {onDone && (
            <Button onClick={onDone} className="h-10">
              {t.spelling.newWords}
            </Button>
          )}
          <Button asChild variant="outline" className="h-10">
            <Link href="/stats">{t.nav.stats}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const m = mastery.status === "ready" ? (mastery.data[`spell:${word.id}`] ?? 0) : 0;
  const review = nextReview && nextReview.wordId === word.id ? nextReview.days : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm text-ink-soft">
        <span className="tabular">
          {num(index + 1)} / {num(words.length)}
        </span>
        <span>
          {t.spelling.level}: {word.level} · {t.spelling.categories[word.category]}
        </span>
      </div>
      <div className="h-1 rounded-full bg-rule" aria-hidden="true">
        <div className="h-full rounded-full bg-brass-fill" style={{ width: `${(index / words.length) * 100}%` }} />
      </div>
      {saveFailed && (
        <p role="alert" className="rounded-lg bg-[var(--error-wash)] p-3 text-sm text-error">
          {t.results.saveFailed}
        </p>
      )}
      <DictationCard
        key={word.id}
        word={word}
        // Sound-alike words cannot be told apart by ear, so their meaning always shows.
        showMeaning={word.category === "homophones" || hintLevel(m) !== "none"}
        onAnswer={(a) => {
          onAnswer(word, a).catch(() => setSaveFailed(true));
        }}
        onNext={() => setIndex((i) => i + 1)}
        extra={review !== null ? <p className="text-sm text-hint">{t.spelling.nextReview(review)}</p> : null}
      />
    </div>
  );
}
