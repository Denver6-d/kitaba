import { describe, expect, it } from "vitest";
import { exampleArabicFrom, wordChunks } from "../../scripts/content/09-publish.mjs";
import { wordChunkSchema } from "@/data/library-schema";
import { wordsFromChunk } from "@/data/library";

/** Step 09 carries an example's Arabic translation into the word chunks: the fallback hint (DECISIONS M4). */
describe("09-publish: example translations", () => {
  const sentences = {
    chunks: {
      "sentences-B2-1": { authors: ["ann", "samir"], rows: [[11, "Exhale slowly now.", 0, [901, "ازفر ببطء الآن.", 1]], [12, "Plain text here.", 0]] },
    },
  };

  it("indexes translations by example id with their own author", () => {
    expect(exampleArabicFrom(sentences)).toEqual({ t11: { id: 901, text: "ازفر ببطء الآن.", author: "samir" } });
  });

  it("writes the translation next to the example, and the loader reads it with its credit", () => {
    const words = [
      { word: "exhale", level: "B2", category: "common", rank: 5000 },
      { word: "plain", level: "B2", category: "common", rank: 5001 },
    ];
    const [chunk] = wordChunks(words, "B2", {
      examples: { exhale: "t11", plain: "t12" },
      exampleText: { t11: ["Exhale slowly now.", "ann"], t12: ["Plain text here.", "ann"] },
      exampleArabic: exampleArabicFrom(sentences),
    });
    const parsed = wordChunkSchema.parse(chunk);
    const [exhale, plain] = wordsFromChunk(parsed);
    expect(exhale?.exampleAr).toEqual({ text: "ازفر ببطء الآن.", credit: { id: 901, author: "samir" } });
    expect(exhale?.exampleCredit).toEqual({ id: 11, author: "ann" });
    expect(plain?.exampleAr).toBeUndefined();
  });
});
