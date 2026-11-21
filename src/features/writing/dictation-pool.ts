import type { DictationText } from "@/data/writing";
import type { LibrarySentence, TatoebaCredit } from "@/data/play-word";
import type { CefrLevel } from "@/domain/model";

/**
 * A dictation text with its Arabic translation (`ar`, one per sentence).
 * Library sentences (Tatoeba) carry their own credit and their translator's.
 */
export type DictItem = DictationText & { readonly credit?: TatoebaCredit; readonly arCredit?: TatoebaCredit };

/**
 * The texts dictation draws from at one level: our own sentences or messages
 * (all translated), plus the open-data library sentences (sentences only) that
 * have a reviewed Arabic translation. A library sentence without one is left
 * out: the learner always gets the meaning as a hint (DECISIONS DT1).
 * Ids never clash (ours are ds-/dm-, the library's t<id>).
 */
export function dictationPool(own: readonly DictationText[], library: readonly LibrarySentence[], level: CefrLevel, kind: "sentence" | "message"): Map<string, DictItem> {
  const pool = new Map<string, DictItem>(own.filter((d) => d.level === level && d.kind === kind && d.ar.length === d.sentences.length).map((d) => [d.id, d]));
  if (kind === "sentence") {
    for (const s of library) {
      if (s.level !== level || !s.ar) continue;
      pool.set(s.id, { id: s.id, level, kind: "sentence", sentences: [s.text], ar: [s.ar.text], credit: s.credit, arCredit: s.ar.credit });
    }
  }
  return pool;
}
