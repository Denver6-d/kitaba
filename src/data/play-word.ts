import type { CefrLevel } from "@/domain/model";
import type { SpellingCategory } from "./schema";

/** Credit for a sentence taken from Tatoeba (CC BY 2.0 FR): shown as "Tatoeba #id · author". */
export interface TatoebaCredit {
  readonly id: number;
  readonly author: string;
}

/**
 * A word a game can play. Hand-written bank words (SpellingWord) always have
 * an Arabic hint and an example; open-data library words may have neither
 * (DECISIONS OD4, OD10), and every game handles that.
 */
export interface PlayWord {
  readonly id: string;
  readonly word: string;
  readonly uk?: string | undefined;
  readonly ar?: string | undefined;
  readonly level: CefrLevel;
  readonly category: SpellingCategory;
  readonly example?: string | undefined;
  readonly confusables?: readonly string[] | undefined;
  /** Set when the example sentence comes from Tatoeba. */
  readonly exampleCredit?: TatoebaCredit | undefined;
  /** True for open-data library words (not the hand-written bank). */
  readonly library?: boolean | undefined;
}

/** A dictation sentence from the open-data library (Tatoeba, CC BY 2.0 FR). */
export interface LibrarySentence {
  /** "t<Tatoeba id>" */
  readonly id: string;
  readonly level: CefrLevel;
  readonly text: string;
  readonly credit: TatoebaCredit;
  /** An Arabic translation linked on Tatoeba, credited to its own author. */
  readonly ar?: { readonly text: string; readonly credit: TatoebaCredit } | undefined;
}

export const tatoebaUrl = (id: number): string => `https://tatoeba.org/sentences/show/${id}`;
