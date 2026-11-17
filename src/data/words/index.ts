import type { SpellingCategory, SpellingWord } from "../schema";
import type { WordRow } from "./row";
import { common } from "./common";
import { homophones } from "./homophones";
import { doubleLetters } from "./double-letters";
import { silentLetters } from "./silent-letters";
import { ieEi } from "./ie-ei";
import { plurals } from "./plurals";
import { verbEndings } from "./verb-endings";
import { adverbsLy } from "./adverbs-ly";
import { prefixes } from "./prefixes";
import { suffixes } from "./suffixes";
import { britishAmerican } from "./british-american";
import { pB } from "./p-b";
import { vF } from "./v-f";
import { shortVowels } from "./short-vowels";
import { vowelConfusion } from "./vowel-confusion";

/**
 * The spelling bank, one file per category. All content was written for this
 * project (no copied word lists). Ids are `w-<word>` and never change, because
 * SRS cards and mastery records refer to them (V1 ids are checked by a test).
 */
export const BANK: Readonly<Record<SpellingCategory, readonly WordRow[]>> = {
  common,
  homophones,
  "double-letters": doubleLetters,
  "silent-letters": silentLetters,
  "ie-ei": ieEi,
  plurals,
  "verb-endings": verbEndings,
  "adverbs-ly": adverbsLy,
  prefixes,
  suffixes,
  "british-american": britishAmerican,
  "p-b": pB,
  "v-f": vF,
  "short-vowels": shortVowels,
  "vowel-confusion": vowelConfusion,
};

export const wordId = (word: string): string => `w-${word.replace(/[^a-z0-9]/g, "-")}`;

export const spellingWords: readonly SpellingWord[] = Object.entries(BANK).flatMap(([category, rows]) =>
  rows.map(([word, ar, level, example, extra]) => {
    const w: SpellingWord = { id: wordId(word), word, ar, level, category: category as SpellingCategory, example };
    return {
      ...w,
      ...(extra?.uk ? { uk: extra.uk } : {}),
      ...(extra?.confusables ? { confusables: [...extra.confusables] } : {}),
    };
  }),
);

export const spellingWordById: ReadonlyMap<string, SpellingWord> = new Map(spellingWords.map((w) => [w.id, w]));
