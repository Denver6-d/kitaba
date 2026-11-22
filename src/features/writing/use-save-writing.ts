"use client";

import { useCallback } from "react";
import type { CefrLevel } from "@/domain/model";
import { levelInfo } from "@/domain/progress/levels";
import { applyAnswer } from "@/domain/spelling/srs";
import type { PracticeWord, WritingSummary } from "@/domain/writing/summary";
import { useRepos } from "@/repositories/provider";
import type { WordRepository } from "@/repositories/types";
import { useAchievementCheck } from "@/features/rewards/use-achievement-check";
import { bankIdBySpelling } from "./bank";

/** SM-2 quality for a word misspelled in writing: a plain miss (DECISIONS S1). */
const MISS_QUALITY = 1;
/** The zod limit on a card's note (export.ts). */
const CONTEXT_MAX = 400;

export interface SavedWriting {
  readonly xp: number;
  /** Words added to (or brought forward in) the review deck: the lower-cased right spellings of `summary.practice`. */
  readonly reviewed: readonly string[];
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
 * How many of the words shown to practise are in the review deck, for "N words were added to your review".
 * Counted from the words shown, so it stays exact when the learner later adds one to their dictionary.
 */
export function addedToReview(practice: readonly PracticeWord[], reviewed: readonly string[]): number {
  const inDeck = new Set(reviewed);
  return practice.filter((p) => inDeck.has(p.right.toLowerCase())).length;
}

/**
 * Adds an SM-2 card for every word of `summary.practice` (and only those: a misspelling with no
 * suggestion is never a card), noted with the sentence it came from.
 */
export async function addToReview(
  words: Pick<WordRepository, "card" | "saveCard">,
  input: { readonly text: string; readonly reference?: string; readonly summary: WritingSummary },
  now: number,
): Promise<Pick<SavedWriting, "reviewed" | "newCards">> {
  const reviewed: string[] = [];
  const newCards: Record<string, string> = {};
  const done = new Set<string>();
  for (const m of input.summary.practice) {
    const id = writingCardId(m.right);
    // colour and color share a card: both are in the deck.
    if (done.has(id)) {
      reviewed.push(m.right.toLowerCase());
      continue;
    }
    done.add(id);
    const existing = await words.card(id);
    const next = applyAnswer(existing, id, MISS_QUALITY, now);
    if (!next) continue;
    // The note is the sentence it came from, with the word spelled right (review may speak it).
    const context = input.reference ? sentenceWith(input.reference, m.right).slice(0, CONTEXT_MAX) : correctedSentence(input.text, m.wrong, m.right);
    const own = id.startsWith("x-");
    await words.saveCard({ ...next, ...(own ? { word: m.right.toLowerCase() } : {}), ...(context ? { context } : {}) });
    if (!existing) newCards[m.wrong.toLowerCase()] = id;
    reviewed.push(m.right.toLowerCase());
  }
  return { reviewed, newCards };
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
        missed: summary.missed.map((m) => ({ wrong: m.wrong, right: m.right, type: m.type })),
      });
      const { reviewed, newCards } = await addToReview(repos.words, input, now);
      await repos.activity.log("writing", input.seconds, summary.xp);
      await checkAchievements();
      const before = levelInfo(xpBefore).level;
      const after = levelInfo(xpBefore + summary.xp).level;
      return { xp: summary.xp, reviewed, levelUp: after > before ? after : null, recordId: record.id, newCards };
    },
    [repos, checkAchievements],
  );
}
