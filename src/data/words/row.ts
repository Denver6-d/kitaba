import type { Level } from "../schema";

/** Extra data for some words: the British spelling, or the words it is confused with. */
export interface WordExtra {
  readonly uk?: string;
  readonly confusables?: readonly string[];
}

/** [American spelling, Arabic hint, level, example sentence, extra?] */
export type WordRow = readonly [word: string, ar: string, level: Level, example: string, extra?: WordExtra];
