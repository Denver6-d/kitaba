"use client";

import { useCallback } from "react";
import { applyAnswer, qualityFor } from "@/domain/spelling/srs";
import { nextMastery } from "@/domain/progress/hints";
import { useRepos } from "@/repositories/provider";

export interface AnswerRecord {
  readonly wordId: string;
  /** The spelling that was expected (for SM-2 quality by letter distance). */
  readonly expected: string;
  readonly answer: string;
  readonly correct: boolean;
  readonly revealed: boolean;
}

/**
 * Stores what one answer means for the word, right away (a closed tab never
 * loses it): misses create or lapse an SM-2 card, due cards are reviewed,
 * and the word's mastery (Arabic hint fading) moves up or down.
 * Returns the days until the next review when a card was written.
 */
export function useRecordAnswer(): (a: AnswerRecord) => Promise<number | null> {
  const repos = useRepos();
  return useCallback(
    async (a) => {
      const now = Date.now();
      const existing = await repos.words.card(a.wordId);
      const next = applyAnswer(existing, a.wordId, qualityFor({ correct: a.correct, revealed: a.revealed, answer: a.answer, word: a.expected }), now);
      if (next) await repos.words.saveCard(next);
      const key = `spell:${a.wordId}`;
      await repos.mastery.set(key, nextMastery(await repos.mastery.get(key), a.correct && !a.revealed));
      return next ? Math.max(0, Math.ceil((next.due - now) / 86_400_000)) : null;
    },
    [repos],
  );
}
