import { describe, expect, it } from "vitest";
import { dictationMessages, dictationSentences } from "@/data/writing";
import type { LibrarySentence } from "@/data/play-word";
import { dictationPool } from "@/features/writing/dictation-pool";

/** Dictation draws from our own texts plus the library's sentences (DECISIONS OD13). */

const lib: LibrarySentence[] = [
  { id: "t1", level: "B1", text: "I like tea.", credit: { id: 1, author: "CK" }, ar: { text: "أحب الشاي.", credit: { id: 9, author: "someone" } } },
  { id: "t2", level: "B1", text: "We walked home.", credit: { id: 2, author: "CK" } },
  { id: "t3", level: "C1", text: "Not this level.", credit: { id: 3, author: "CK" } },
];

describe("dictationPool", () => {
  it("adds library sentences at the level, with their credit and translation, to our own", () => {
    const pool = dictationPool(dictationSentences, lib, "B1", "sentence");
    const own = dictationSentences.filter((d) => d.level === "B1");
    expect(pool.size).toBe(own.length + 2);
    expect(pool.get("t1")).toMatchObject({ kind: "sentence", sentences: ["I like tea."], credit: { id: 1, author: "CK" }, ar: { text: "أحب الشاي." } });
    expect(pool.get("t2")?.ar).toBeUndefined();
    expect(pool.has("t3")).toBe(false);
    for (const d of own) expect(pool.get(d.id)?.credit).toBeUndefined();
  });
  it("uses our own texts alone when the library is unavailable, and never mixes library sentences into messages", () => {
    expect(dictationPool(dictationSentences, [], "A2", "sentence").size).toBe(dictationSentences.filter((d) => d.level === "A2").length);
    const messages = dictationPool(dictationMessages, lib, "B1", "message");
    expect([...messages.values()].every((d) => d.kind === "message" && !d.credit)).toBe(true);
  });
});
