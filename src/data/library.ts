import type { CefrLevel } from "@/domain/model";
import type { SentenceChunk, WordChunk } from "./library-schema";
import type { LibrarySentence, PlayWord } from "./play-word";
import type { SpellingCategory } from "./schema";

/**
 * Pure conversions from the published library chunks (public/content/v1) to
 * the objects the games use. Loading and caching live in
 * features/library/library.ts.
 */

/** Same id scheme as the bank (`w-<word>`), so SRS cards work the same way. */
export const libraryWordId = (word: string): string => `w-${word.replace(/[^a-z0-9]/g, "-")}`;

export function wordsFromChunk(chunk: WordChunk): PlayWord[] {
  const out: PlayWord[] = [];
  for (const [category, rows] of Object.entries(chunk.words) as [SpellingCategory, WordChunk["words"][SpellingCategory]][]) {
    for (const [word, , extra] of rows ?? []) {
      const ex = extra?.ex ? chunk.examples[extra.ex] : undefined;
      const author = ex && ex[1] >= 0 ? chunk.authors[ex[1]] : undefined;
      const tr = ex?.[2];
      out.push({
        id: libraryWordId(word),
        word,
        level: chunk.level,
        category,
        library: true,
        ...(extra?.uk ? { uk: extra.uk } : {}),
        ...(extra?.ar ? { ar: extra.ar } : {}),
        ...(extra?.c ? { confusables: extra.c } : {}),
        ...(ex ? { example: ex[0] } : {}),
        ...(ex && author && extra?.ex?.startsWith("t") ? { exampleCredit: { id: Number(extra.ex.slice(1)), author } } : {}),
        // A translation is shown only with its author's credit (CC BY).
        ...(tr && chunk.authors[tr[2]] ? { exampleAr: { text: tr[1], credit: { id: tr[0], author: chunk.authors[tr[2]]! } } } : {}),
      });
    }
  }
  return out;
}

export function sentencesFromChunk(chunk: SentenceChunk): LibrarySentence[] {
  return chunk.rows.map(([id, text, a, ar]) => ({
    id: `t${id}`,
    level: chunk.level,
    text,
    credit: { id, author: chunk.authors[a] ?? "" },
    ...(ar ? { ar: { text: ar[1], credit: { id: ar[0], author: chunk.authors[ar[2]] ?? "" } } } : {}),
  }));
}

/** Manifest keys of one level's word or sentence chunks, in part order. */
export function chunkKeys(files: Readonly<Record<string, unknown>>, kind: "words" | "sentences", level: CefrLevel): string[] {
  const re = new RegExp(`^${kind}-${level}-(\\d+)$`);
  return Object.keys(files)
    .flatMap((k) => {
      const m = re.exec(k);
      return m ? [[k, Number(m[1])] as const] : [];
    })
    .sort((a, b) => a[1] - b[1])
    .map(([k]) => k);
}
