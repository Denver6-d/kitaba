import { charDistance } from "../sentences/classify";

/**
 * SM-2 spaced repetition (Wozniak, 1987), the classic SuperMemo-2 rules:
 * quality 0–5; below 3 restarts the repetitions; ease starts at 2.5 and never
 * drops below 1.3; intervals are 1 day, 6 days, then interval × ease.
 */

export const DAY_MS = 86_400_000;
export const MIN_EASE = 1.3;

export interface SrsCard {
  readonly wordId: string;
  readonly ease: number;
  /** Days until the next review. */
  readonly interval: number;
  readonly reps: number;
  readonly lapses: number;
  readonly due: number;
  readonly lastReviewed: number;
}

export function newCard(wordId: string, now: number): SrsCard {
  return { wordId, ease: 2.5, interval: 0, reps: 0, lapses: 0, due: now, lastReviewed: 0 };
}

export function review(card: SrsCard, rawQuality: number, now: number): SrsCard {
  const q = Math.max(0, Math.min(5, Math.round(rawQuality)));
  const ease = Math.max(MIN_EASE, round2(card.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))));
  if (q < 3) {
    return { ...card, ease, reps: 0, interval: 1, lapses: card.lapses + 1, due: now + DAY_MS, lastReviewed: now };
  }
  const reps = card.reps + 1;
  // As in SM-2, the interval grows by the ease factor in effect before this review.
  const interval = reps === 1 ? 1 : reps === 2 ? 6 : Math.round(card.interval * card.ease);
  return { ...card, ease, reps, interval, due: now + interval * DAY_MS, lastReviewed: now };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Maps a dictation answer to an SM-2 quality score. */
export function qualityFor(a: { correct: boolean; revealed: boolean; answer: string; word: string }): number {
  // Revealing the word is only offered when no English voice exists, so it is
  // the device's limitation, not a weak answer: 4, not 3 (which would erode ease).
  if (a.correct) return a.revealed ? 4 : 5;
  if (a.answer.trim() === "") return 0;
  return charDistance(a.answer.trim().toLowerCase(), a.word) <= 2 ? 2 : 1;
}

export function daysUntil(due: number, now: number): number {
  return Math.max(0, Math.ceil((due - now) / DAY_MS));
}

/**
 * What an answer does to a word's card.
 * - No card: a miss creates one; a correct answer needs none (the word is known).
 * - Due card: a normal SM-2 review.
 * - Card not yet due (practised early): a miss still counts as a lapse, but a
 *   correct answer leaves the schedule alone, so early practice cannot inflate intervals.
 */
export function applyAnswer(card: SrsCard | undefined, wordId: string, quality: number, now: number): SrsCard | null {
  const correct = quality >= 3;
  if (!card) return correct ? null : review(newCard(wordId, now), quality, now);
  if (card.due > now && correct) return null;
  return review(card, quality, now);
}
