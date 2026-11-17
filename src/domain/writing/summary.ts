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

export interface WritingSummary {
  readonly words: number;
  readonly mistakes: number;
  /** 0–1. */
  readonly accuracy: number;
  readonly byType: Readonly<Partial<Record<MistakeType, number>>>;
  /** Distinct words to practise (lower case right spellings), in order of appearance. */
  readonly practice: readonly WritingMistake[];
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
  const practice = mistakes.filter((m) => {
    const key = (m.right ?? m.wrong).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const stars = words < MIN_WORDS_FOR_STARS ? 0 : starsFor(accuracy, words);
  // One XP per correct word (capped), plus 5 per star: long careful texts earn more, but not without limit.
  const xp = Math.min(MAX_WRITING_XP, words - count) + stars * 5;
  return { words, mistakes: count, accuracy, byType, practice, stars, xp };
}
