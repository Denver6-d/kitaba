import { starsFor } from "../games/engine";
import type { MistakeType } from "./classify";

/**
 * End-of-text summary for free writing and dictation: spelling accuracy,
 * mistakes by type, the words to practise, stars and XP. Stars use the game
 * thresholds (DESIGN "game feel"): 1 at ≥ 60%, 2 at ≥ 80%, 3 at ≥ 95%.
 */

export interface WritingMistake {
  /** As the learner wrote it. */
  readonly wrong: string;
  /** The right spelling (null when the checker had no suggestion). */
  readonly right: string | null;
  readonly type: MistakeType;
}

/** A mistake with a right spelling that becomes a review card. */
export interface PracticeWord extends WritingMistake {
  readonly right: string;
}

/**
 * Whether a mistake becomes a review card: it needs a single-word right spelling. A missing capital
 * (i → I) or a split word (alot → a lot) is a rule, not a word to learn; a word with no suggestion has
 * nothing to practise, and its misspelling must never be shown or reviewed as if it were right.
 */
export const isPracticeWord = (m: WritingMistake): m is PracticeWord => !!m.right && !m.right.includes(" ") && m.type !== "capital";

export interface WritingSummary {
  readonly words: number;
  readonly mistakes: number;
  /** 0–1. */
  readonly accuracy: number;
  readonly byType: Readonly<Partial<Record<MistakeType, number>>>;
  /** Distinct mistakes (by right spelling, or by the misspelling when there is none), in order of appearance: the history record. */
  readonly missed: readonly WritingMistake[];
  /** Distinct words to practise, in order of appearance: exactly the words that go to the review deck (`isPracticeWord`). */
  readonly practice: readonly PracticeWord[];
  /** Distinct misspellings the checker found no suggestion for: shown as such, never as words to practise. */
  readonly unmatched: readonly WritingMistake[];
  readonly stars: number;
  readonly xp: number;
}

/** Below this many words a text earns no stars (one right word is not a 100% message). */
export const MIN_WORDS_FOR_STARS = 3;
export const MAX_WRITING_XP = 60;

/**
 * `errors` is how many words count as wrong (defaults to the mistakes listed);
 * dictation also counts missing and extra words, which are not spelling mistakes to practise.
 */
export function summarizeWriting(words: number, mistakes: readonly WritingMistake[], errors = mistakes.length): WritingSummary {
  const count = Math.min(errors, words);
  const accuracy = words === 0 ? 0 : (words - count) / words;
  const byType: Partial<Record<MistakeType, number>> = {};
  for (const m of mistakes) byType[m.type] = (byType[m.type] ?? 0) + 1;
  const seen = new Set<string>();
  const missed = mistakes.filter((m) => {
    // A misspelling with no suggestion never shares a key with a right spelling.
    const key = m.right === null ? `?${m.wrong.toLowerCase()}` : m.right.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const practice = missed.filter(isPracticeWord);
  const unmatched = missed.filter((m) => m.right === null);
  const stars = words < MIN_WORDS_FOR_STARS ? 0 : starsFor(accuracy, words);
  // One XP per correct word (capped), plus 5 per star: long careful texts earn more, but not without limit.
  const xp = Math.min(MAX_WRITING_XP, words - count) + stars * 5;
  return { words, mistakes: count, accuracy, byType, missed, practice, unmatched, stars, xp };
}
