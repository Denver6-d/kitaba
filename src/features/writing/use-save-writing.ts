"use client";

import { useCallback } from "react";
import type { CefrLevel } from "@/domain/model";
import { levelInfo } from "@/domain/progress/levels";
import { applyAnswer } from "@/domain/spelling/srs";
import type { WritingSummary } from "@/domain/writing/summary";
import { useRepos } from "@/repositories/provider";
import { useAchievementCheck } from "@/features/rewards/use-achievement-check";
import { bankIdBySpelling } from "./bank";

/** SM-2 quality for a word misspelled in writing: a plain miss (DECISIONS S1). */
const MISS_QUALITY = 1;
/** The zod limit on a card's note (export.ts). */
const CONTEXT_MAX = 400;

export interface SavedWriting {
  readonly xp: number;
  /** Words added to (or brought forward in) the review deck. */
  readonly reviewed: number;
  readonly levelUp: number | null;
  /** The history record, so it can be amended when the learner adds a word to their dictionary. */
  readonly recordId: string;
  /** Cards this check created (lower-cased misspelling → card id); they are removed again if the word was a name. */
  readonly newCards: Readonly<Record<string, string>>;
}

/** The review-card id for a misspelled word: the bank's id when the bank has it, otherwise "x-<word>". */
export function writingCardId(right: string): string {
  const lower = right.toLowerCase();
  return bankIdBySpelling.get(lower) ?? `x-${lower.replace(/[^a-z'-]/g, "")}`;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** `word` as a whole word (so "wich" does not match inside "sandwich"). */
const wholeWord = (word: string) => new RegExp(`(?<![A-Za-z'])${escapeRe(word)}(?![A-Za-z])`, "i");

/** Finds the sentence of `text` that contains `word` as a whole word, for the review card's note. */
export function sentenceWith(text: string, word: string): string {
  const re = wholeWord(word);
  const sentences = text.split(/(?<=[.!?])\s+|\n+/);
  return (sentences.find((s) => re.test(s)) ?? "").trim();
}

/** The sentence with the misspelling replaced by the right spelling (whole word only), capped for storage. */
export function correctedSentence(text: string, wrong: string, right: string): string {
  return sentenceWith(text, wrong).replace(wholeWord(wrong), right).slice(0, CONTEXT_MAX);
}

/**
 * Saves a finished text or dictation: the history record, activity (streak
 * and XP) and an SM-2 card for every misspelled word, noted with the sentence
 * it came from (DECISIONS F7).
 */
export function useSaveWriting() {
  const repos = useRepos();
  const checkAchievements = useAchievementCheck();
  return useCallback(
    async (input: {
      mode: "free" | "dictation";
      sourceId: string;
      level: CefrLevel;
      text: string;
      /** For dictation: the original text (the card's note shows the right sentence). */
      reference?: string;
      summary: WritingSummary;
      seconds: number;
    }): Promise<SavedWriting> => {
      const { summary } = input;
      const now = Date.now();
      const xpBefore = (await repos.activity.list()).reduce((n, a) => n + a.xp, 0);
      const record = await repos.writing.save({
        mode: input.mode,
        sourceId: input.sourceId,
        level: input.level,
        text: input.text,
        words: summary.words,
        mistakes: summary.mistakes,
        accuracy: summary.accuracy,
        stars: summary.stars,
        at: now,
        missed: summary.practice.map((m) => ({ wrong: m.wrong, right: m.right, type: m.type })),
      });
      let reviewed = 0;
      const newCards: Record<string, string> = {};
      for (const m of summary.practice) {
        if (!m.right || m.right.includes(" ") || m.type === "capital") continue;
        const id = writingCardId(m.right);
        const existing = await repos.words.card(id);
        const next = applyAnswer(existing, id, MISS_QUALITY, now);
        if (!next) continue;
        // The note is the sentence it came from, with the word spelled right (review may speak it).
        const context = input.reference ? sentenceWith(input.reference, m.right).slice(0, CONTEXT_MAX) : correctedSentence(input.text, m.wrong, m.right);
        const own = id.startsWith("x-");
        await repos.words.saveCard({ ...next, ...(own ? { word: m.right.toLowerCase() } : {}), ...(context ? { context } : {}) });
        if (!existing) newCards[m.wrong.toLowerCase()] = id;
        reviewed += 1;
      }
      await repos.activity.log("writing", input.seconds, summary.xp);
      await checkAchievements();
      const before = levelInfo(xpBefore).level;
      const after = levelInfo(xpBefore + summary.xp).level;
      return { xp: summary.xp, reviewed, levelUp: after > before ? after : null, recordId: record.id, newCards };
    },
    [repos, checkAchievements],
  );
}
