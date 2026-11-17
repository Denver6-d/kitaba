import { commonWords, typingPhrases, typingSentences } from "@/data/typing";
import { buildTestText, type TestText } from "@/domain/typing/text";
import type { Rng } from "@/domain/shared/random";
import type { Level } from "@/data/schema";

/** Generous characters per second so even very fast typists never run out of text. */
const CHARS_PER_SECOND_BUFFER = 14;

const wordItems = commonWords.map((w, i) => ({ id: `w-${i}`, text: w === "I" ? w : w.toLowerCase() }));

export function textForTest(source: "sentences" | "words", durationSec: number, rng: Rng, level: Level | null): TestText {
  const min = durationSec * CHARS_PER_SECOND_BUFFER;
  if (source === "words") return buildTestText(wordItems, min, rng);
  // Full sentences (phrases are used in drills), up to one level above the learner.
  const pool = typingSentences.filter((s) => level === null || levelRank(s.level) <= levelRank(level) + 1);
  return buildTestText(pool, min, rng);
}

const levelRank = (l: Level) => (l === "A1" ? 0 : l === "A2" ? 1 : 2);

const meaningById = new Map([...typingSentences, ...typingPhrases].map((s) => [s.id, s.ar]));
export const typingMeaning = (id: string): string | null => meaningById.get(id) ?? null;
