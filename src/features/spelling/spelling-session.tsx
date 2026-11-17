"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type { SpellingWord } from "@/data/schema";
import { daysUntil, newCard, qualityFor, review } from "@/domain/spelling/srs";
import { hintLevel, nextMastery } from "@/domain/progress/hints";
import { xpFor } from "@/domain/progress/levels";
import { useI18n } from "@/i18n";
import { useRepoQuery, useRepos } from "@/repositories/provider";
import { Button } from "@/components/ui/button";
import { useAchievementCheck } from "@/features/rewards/use-achievement-check";
import { DictationCard, type DictationAnswer } from "./dictation-card";

const SECONDS_PER_WORD = 15;

/**
 * A run through a list of words. Misspelled words get an SM-2 card; words that
 * already have a card are reviewed. Correct answers on new words need no card.
 */
export function SpellingSession({ words, onDone }: { words: readonly SpellingWord[]; onDone?: () => void }) {
  const { t, num } = useI18n();
  const repos = useRepos();
  const checkAchievements = useAchievementCheck();
  const mastery = useRepoQuery((r) => r.sentences.allMastery());
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [nextReview, setNextReview] = useState<number | null>(null);

  const word = words[index];

  const onAnswer = useCallback(
    async (w: SpellingWord, a: DictationAnswer) => {
      const now = Date.now();
      const q = qualityFor({ ...a, word: w.word });
      if (a.correct) setCorrect((c) => c + 1);
      const existing = await repos.words.card(w.id);
      if (existing || !a.correct) {
        const next = review(existing ?? newCard(w.id, now), q, now);
        await repos.words.saveCard(next);
        setNextReview(daysUntil(next.due, now));
      } else {
        setNextReview(null);
      }
      const key = `spell:${w.id}`;
      await repos.sentences.setMastery(key, nextMastery(mastery.status === "ready" ? (mastery.data[key] ?? 0) : 0, a.correct && !a.revealed));
      // A dictation item takes roughly 15 seconds; used for the daily-goal minutes.
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
      <DictationCard
        key={word.id}
        word={word}
        showMeaning={hintLevel(m) !== "none"}
        onAnswer={(a) => void onAnswer(word, a)}
        onNext={() => {
          setNextReview(null);
          setIndex((i) => i + 1);
        }}
        extra={nextReview !== null ? <p className="text-sm text-hint">{t.spelling.nextReview(nextReview)}</p> : null}
      />
    </div>
  );
}
