import type { Rng } from "../shared/random";
import { shuffle } from "../shared/random";
import { expectedSpelling, normalizeAnswer, type Accent } from "../spelling/check";
import { maskWord, misspellings, scramble, trickyPositions } from "../spelling/misspell";
import type { GameItem, ItemMode } from "./engine";

/** The word data an item needs (a subset of the content schema). */
export interface ItemWord {
  readonly id: string;
  readonly word: string;
  readonly uk?: string | undefined;
  readonly category: string;
  /** Library words may have no example (DECISIONS OD10): modes that need one skip the word. */
  readonly example?: string | undefined;
  readonly confusables?: readonly string[] | undefined;
}

export interface BuildContext {
  readonly accent: Accent;
  readonly rng: Rng;
  /** Every spelling in the bank: distractors must not be real words (homophones excepted). */
  readonly bankSpellings: ReadonlySet<string>;
}

/** Dictation sentences: short enough to type from one hearing. */
export const DICTATION_MAX_WORDS = 12;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Index of the example token that holds the word (case-insensitive, ignoring punctuation), or -1. */
export function findWordToken(tokens: readonly string[], word: string): number {
  const re = new RegExp(`^[^A-Za-z']*${escapeRe(word)}[^A-Za-z']*$`, "i");
  return tokens.findIndex((t) => re.test(t));
}

/** Replaces the word inside a token, keeping punctuation and a leading capital. */
function replaceInToken(token: string, word: string, replacement: string): string {
  return token.replace(new RegExp(escapeRe(word), "i"), (m) =>
    m[0] && m[0] !== m[0].toLowerCase() ? replacement[0]?.toUpperCase() + replacement.slice(1) : replacement,
  );
}

/** "I like ____ color." for homophones in choice mode. */
export function blankedContext(example: string, word: string): string {
  return example.replace(new RegExp(`\\b${escapeRe(word)}\\b`, "i"), "____");
}

/** Normalised word sequence for sentence dictation (case and punctuation do not count). */
export function normalizeSentence(s: string): string {
  return normalizeAnswer(s)
    .replace(/[^a-z0-9' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildItem(mode: ItemMode, w: ItemWord, ctx: BuildContext, key: string): GameItem | null {
  const answer = expectedSpelling(w, ctx.accent);
  const base = { key, wordId: w.id, mode, answer } as const;
  const isHomophone = w.category === "homophones";
  const avoid = new Set([...ctx.bankSpellings].filter((s) => s !== answer));
  const misspellingOf = (n: number) => misspellings({ word: answer, category: w.category, ...(w.uk ? { uk: w.uk } : {}) }, n, ctx.rng, avoid);

  switch (mode) {
    case "listen":
    case "bee":
    case "review":
      // Sound-alike words are spoken with their example, or they would be a guess.
      if (isHomophone && !w.example) return null;
      return { ...base, kind: "typed", speak: isHomophone ? `${answer}. ${w.example}` : answer };
    case "missing": {
      const positions = trickyPositions({ word: answer, category: w.category });
      return { ...base, kind: "typed", masked: maskWord(answer, positions), speak: answer };
    }
    case "scramble":
      return { ...base, kind: "typed", letters: scramble(answer, ctx.rng) };
    case "choice": {
      const confusables = isHomophone ? (w.confusables ?? []).filter((c) => c !== answer).slice(0, 3) : [];
      const wrong = [...confusables, ...misspellingOf(3)].filter((c, i, a) => a.indexOf(c) === i).slice(0, 3);
      if (wrong.length < 2) return null;
      return {
        ...base,
        kind: "choice",
        options: shuffle([answer, ...wrong], ctx.rng),
        ...(isHomophone && w.example ? { context: blankedContext(w.example, w.word) } : {}),
      };
    }
    case "fix": {
      if (!w.example) return null;
      const tokens = w.example.split(" ");
      const index = findWordToken(tokens, w.word);
      const [wrong] = misspellingOf(1);
      if (index === -1 || !wrong) return null;
      const shown = tokens.map((t, i) => (i === index ? replaceInToken(t, w.word, wrong) : t));
      return { ...base, kind: "fix", tokens: shown, wrongIndex: index, speak: w.example };
    }
    case "sentence":
      // Too long to type from one hearing: the caller falls back to a word item.
      if (!w.example || w.example.trim().split(/\s+/).length > DICTATION_MAX_WORDS) return null;
      return { ...base, kind: "sentence", answer: w.example, speak: w.example };
  }
}

/** Checks a sentence dictation answer (case and punctuation ignored). */
export function sentenceMatches(answer: string, expected: string): boolean {
  return normalizeSentence(answer) === normalizeSentence(expected);
}
