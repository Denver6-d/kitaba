import type { DictationText } from "@/data/writing";
import type { LibrarySentence, TatoebaCredit } from "@/data/play-word";
import type { CefrLevel } from "@/domain/model";

/** A dictation text; library sentences (Tatoeba) carry their credit and, sometimes, an Arabic translation. */
export type DictItem = DictationText & { readonly credit?: TatoebaCredit; readonly ar?: LibrarySentence["ar"] };

/**
 * The texts dictation draws from at one level: our own sentences or messages,
 * plus the open-data library sentences (sentences only) when they loaded.
 * Ids never clash (ours are ds-/dm-, the library's t<id>).
 */
export function dictationPool(own: readonly DictationText[], library: readonly LibrarySentence[], level: CefrLevel, kind: "sentence" | "message"): Map<string, DictItem> {
  const pool = new Map<string, DictItem>(own.filter((d) => d.level === level && d.kind === kind).map((d) => [d.id, d]));
  if (kind === "sentence") {
    for (const s of library) {
      if (s.level !== level) continue;
      pool.set(s.id, { id: s.id, level, kind: "sentence", sentences: [s.text], credit: s.credit, ...(s.ar ? { ar: s.ar } : {}) });
    }
  }
  return pool;
}
