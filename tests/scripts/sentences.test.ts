import { describe, expect, it } from "vitest";
import { normalizeText, signature } from "../../scripts/content/05-sentences.mjs";
import { wordChunks } from "../../scripts/content/09-publish.mjs";

/** Sentence filtering helpers (step 05) and word chunk packing (step 09). */

describe("normalizeText", () => {
  it("straightens typographic apostrophes and spaces", () => {
    expect(normalizeText("I don’t know.")).toBe("I don't know.");
  });
  it("refuses anything that is not plain printable English", () => {
    expect(normalizeText("This costs €30.")).toBeNull();
    expect(normalizeText("Live — then marry.")).toBeNull();
  });
});

describe("signature (near duplicates)", () => {
  const names = new Set(["Tom", "Mary", "I"]);
  it("treats the same words in another order, or another story name, as the same sentence", () => {
    expect(signature("Tom is tired.", names)).toBe(signature("Mary is tired.", names));
    expect(signature("Is Tom tired?", names)).toBe(signature("Tom is tired.", names));
  });
  it("keeps different sentences apart", () => {
    expect(signature("Tom is tired.", names)).not.toBe(signature("Tom is hungry.", names));
  });
});

describe("wordChunks", () => {
  const words = [
    { word: "knight", level: "B1", category: "homophones", rank: 3000, confusables: ["night"], fallback: "silent-letters" },
    { word: "flour", level: "B1", category: "homophones", rank: 3001, confusables: ["flower"], fallback: "vowel-confusion" },
    { word: "colour", level: "B1", category: "common", rank: 3002 },
  ];
  it("keeps a homophone with an example, and moves one without to its next category", () => {
    const [chunk] = wordChunks(words, "B1", { examples: { knight: "t7" }, exampleText: { t7: ["The knight rode home.", "CK"] } });
    expect(chunk?.words.homophones).toEqual([["knight", 3000, { c: ["night"], ex: "t7" }]]);
    expect(chunk?.words["vowel-confusion"]).toEqual([["flour", 3001]]);
    expect(chunk?.examples).toEqual({ t7: ["The knight rode home.", 0] });
    expect(chunk?.authors).toEqual(["CK"]);
  });
  it("marks our own example sentences with author -1", () => {
    const [chunk] = wordChunks(words, "B1", { examples: { colour: "o1" }, exampleText: { o1: ["What colour is it?", null] } });
    expect(chunk?.examples.o1).toEqual(["What colour is it?", -1]);
    expect(chunk?.authors).toEqual([]);
  });
  it("splits a level into parts within the byte budget, each with its own examples", () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ word: `word${String.fromCharCode(97 + (i % 26))}${i}`, level: "C1", category: "common", rank: 9000 + i }));
    const parts = wordChunks(many, "C1", { budget: 200 });
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.flatMap((p) => p.words.common ?? []).length).toBe(50);
  });
});
