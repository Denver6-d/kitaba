import { describe, expect, it } from "vitest";
import { hideWordIn, hintFor, hintKind, HINT_BLANK, looksLike } from "@/domain/spelling/hint";
import { hintedPoolAtLevel } from "@/domain/levels/pool";
import type { CefrLevel } from "@/domain/model";

/** Every game word has a hint, and a fallback hint never gives the spelling away (DECISIONS M4). */

describe("hideWordIn", () => {
  it("hides the word wherever it appears, whatever its case", () => {
    expect(hideWordIn("Right now, turn right.", "right")).toBe(`${HINT_BLANK} now, turn ${HINT_BLANK}.`);
  });
  it("hides forms that would show the spelling", () => {
    expect(hideWordIn("Alright, you have the right to stay.", "right")).toBe(`${HINT_BLANK}, you have the ${HINT_BLANK} to stay.`);
    expect(hideWordIn("She studies while he studied.", "studied")).toBe(`She ${HINT_BLANK} while he ${HINT_BLANK}.`);
    expect(hideWordIn("Stop stopping me.", "stopping")).toBe(`${HINT_BLANK} ${HINT_BLANK} me.`);
    expect(hideWordIn("It's a well-known place.", "well-known")).toBe(`It's a ${HINT_BLANK} place.`);
  });
  it("hides the British spelling too", () => {
    expect(hideWordIn("What colour is the color chart?", "color", "colour")).toBe(`What ${HINT_BLANK} is the ${HINT_BLANK} chart?`);
  });
  it("hides relatives the review found visible (powerful, grandson, cities, knives, disbelief, co-operation, goes)", () => {
    const cases: [string, string][] = [
      ["The powerful walk all over the powerless.", "powerless"],
      ["I have a grandson and three granddaughters.", "granddaughters"],
      ["There are more creators than creations.", "creators"],
      ["We need more waiters than waitresses.", "waitresses"],
      ["Evolution is slow, and life evolves.", "evolves"],
      ["Singing is what singers do.", "singers"],
      ["Two cities and one city.", "city"],
      ["Sharp knives and a knife.", "knife"],
      ["Disbelief, then I believe.", "believe"],
      ["We need co-operation and cooperation.", "cooperation"],
      ["He goes where I go.", "go"],
    ];
    for (const [sentence, word] of cases) {
      const masked = hideWordIn(sentence, word);
      expect(masked, word).not.toBeNull();
      expect(masked!.split(/[^A-Za-z]+/).filter((t) => t.length > 1).map((t) => t.toLowerCase()), `${word}: ${masked}`).toEqual(
        sentence.split(/[^A-Za-z-]+/).filter((t) => t.length > 1 && !looksLike(t, word)).map((t) => t.toLowerCase().replace(/-/g, "")),
      );
    }
    expect(hideWordIn("The powerful walk all over the powerless.", "powerless")).toBe(`The ${HINT_BLANK} walk all over the ${HINT_BLANK}.`);
    expect(hideWordIn("Two cities and one city.", "city")).toBe(`Two ${HINT_BLANK} and one ${HINT_BLANK}.`);
  });
  it("uses one blank for every length, so the blank does not tell the length", () => {
    expect(hideWordIn("I like cats.", "cats")).toBe(`I like ${HINT_BLANK}.`);
    expect(hideWordIn("I like elephants.", "elephants")).toBe(`I like ${HINT_BLANK}.`);
  });
  it("keeps unrelated words and returns null when the word is not in the sentence", () => {
    expect(hideWordIn("The cat sat.", "cat")).toBe(`The ${HINT_BLANK} sat.`);
    expect(hideWordIn("We read books.", "dog")).toBeNull();
    expect(looksLike("the", "then")).toBe(false);
    expect(looksLike("study", "studied")).toBe(true);
  });
});

describe("hintFor", () => {
  it("prefers the word's own Arabic hint", () => {
    expect(hintFor({ word: "right", ar: "صحيح / يمين", example: "Turn right." })).toEqual({ kind: "ar", text: "صحيح / يمين" });
  });
  it("falls back to the example with the word hidden, plus its Arabic translation when there is one", () => {
    expect(hintFor({ word: "exhale", example: "Exhale slowly." })).toEqual({ kind: "sentence", masked: `${HINT_BLANK} slowly.` });
    expect(hintFor({ word: "exhale", example: "Exhale slowly.", exampleAr: { text: "ازفر ببطء." } })).toEqual({ kind: "sentence", masked: `${HINT_BLANK} slowly.`, ar: "ازفر ببطء." });
  });
  it("gives no hint when there is neither an Arabic hint nor an example that contains the word", () => {
    expect(hintFor({ word: "exhale" })).toBeNull();
    expect(hintFor({ word: "exhale", example: "Breathe out." })).toBeNull();
  });
  it("never puts the hidden word into the fallback hint", () => {
    const h = hintFor({ word: "receive", example: "Did you receive my letter? I received it." });
    expect(h?.kind).toBe("sentence");
    expect(JSON.stringify(h).toLowerCase()).not.toContain("receiv");
  });
});

describe("hintedPoolAtLevel", () => {
  type W = { id: string; level: CefrLevel; kind: "ar" | "fallback" | null };
  const w = (id: string, level: CefrLevel, kind: W["kind"]): W => ({ id, level, kind });
  const words = [w("a1", "B1", "ar"), w("a2", "B1", "ar"), w("f1", "B1", "fallback"), w("n1", "B1", null), w("a3", "A2", "ar"), w("f2", "A2", "fallback")];
  const of = (x: W) => x.kind;
  const ids = (r: { pool: W[] }) => r.pool.map((x) => x.id);

  it("uses only words with their own Arabic hint when the level has enough", () => {
    expect(hintedPoolAtLevel(words, "B1", 2, of)).toEqual({ pool: [words[0], words[1]], levels: ["B1"] });
  });
  it("adds fallback-hint words of the same level before widening to another level", () => {
    expect(ids(hintedPoolAtLevel(words, "B1", 3, of))).toEqual(["a1", "a2", "f1"]);
    expect(hintedPoolAtLevel(words, "B1", 3, of).levels).toEqual(["B1"]);
    expect(ids(hintedPoolAtLevel(words, "B1", 4, of))).toEqual(["a1", "a2", "f1", "a3"]);
  });
  it("never includes a word without a hint", () => {
    expect(ids(hintedPoolAtLevel(words, "B1", 99, of))).not.toContain("n1");
  });
  it("works with real hint kinds", () => {
    expect(hintKind({ word: "cat", ar: "قطة" })).toBe("ar");
    expect(hintKind({ word: "cat", example: "A cat sat." })).toBe("fallback");
    expect(hintKind({ word: "cat" })).toBeNull();
  });
});
