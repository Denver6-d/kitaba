import { describe, expect, it } from "vitest";
import { dictationMessages, dictationSentences } from "@/data/writing";
import type { LibrarySentence } from "@/data/play-word";
import { dictationPool } from "@/features/writing/dictation-pool";

/**
 * Dictation draws from our own texts plus the library's sentences (DECISIONS
 * OD13), and only texts with an Arabic translation (DT1).
 */

const lib: LibrarySentence[] = [
  { id: "t1", level: "B1", text: "I like tea.", credit: { id: 1, author: "CK" }, ar: { text: "أحب الشاي.", credit: { id: 9, author: "someone" } } },
  { id: "t2", level: "B1", text: "We walked home.", credit: { id: 2, author: "CK" } },
  { id: "t3", level: "C1", text: "Not this level.", credit: { id: 3, author: "CK" }, ar: { text: "ليست هذه.", credit: { id: 8, author: "x" } } },
];

describe("dictationPool", () => {
  it("adds translated library sentences at the level, with both credits, to our own", () => {
    const pool = dictationPool(dictationSentences, lib, "B1", "sentence");
    const own = dictationSentences.filter((d) => d.level === "B1");
    expect(pool.size).toBe(own.length + 1);
    expect(pool.get("t1")).toMatchObject({ kind: "sentence", sentences: ["I like tea."], ar: ["أحب الشاي."], credit: { id: 1, author: "CK" }, arCredit: { id: 9, author: "someone" } });
    expect(pool.has("t3")).toBe(false);
    for (const d of own) {
      expect(pool.get(d.id)?.credit).toBeUndefined();
      expect(pool.get(d.id)?.ar).toHaveLength(1);
    }
  });
  it("leaves out a library sentence without an Arabic translation", () => {
    expect(dictationPool(dictationSentences, lib, "B1", "sentence").has("t2")).toBe(false);
  });
  it("gives every drawn text one Arabic line per sentence, messages included", () => {
    for (const level of ["A1", "B2", "C1"] as const) {
      for (const kind of ["sentence", "message"] as const) {
        const pool = dictationPool(kind === "sentence" ? dictationSentences : dictationMessages, lib, level, kind);
        expect(pool.size, `${kind} ${level}`).toBeGreaterThan(0);
        for (const d of pool.values()) expect(d.ar.length, d.id).toBe(d.sentences.length);
      }
    }
  });
  it("leaves out one of our own texts whose translation does not line up", () => {
    const broken = { ...dictationSentences[0]!, id: "ds-a1-999", ar: [] as string[] };
    expect(dictationPool([broken], [], broken.level, "sentence").size).toBe(0);
  });
  it("uses our own texts alone when the library is unavailable, and never mixes library sentences into messages", () => {
    expect(dictationPool(dictationSentences, [], "A2", "sentence").size).toBe(dictationSentences.filter((d) => d.level === "A2").length);
    const messages = dictationPool(dictationMessages, lib, "B1", "message");
    expect([...messages.values()].every((d) => d.kind === "message" && !d.credit)).toBe(true);
  });
});
