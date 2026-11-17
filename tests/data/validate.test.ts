import { describe, expect, it } from "vitest";
import { dictationSentences, validateContent } from "@/data/validate";
import type { SpellingWord } from "@/data/schema";

/** Dictation limit (DECISIONS V10); kept literal so the test does not depend on where the constant lives. */
const DICTATION_MAX_WORDS = 12;

/** Each integrity rule of the content validator, on small hand-made banks. */

const word = (over: Partial<SpellingWord> = {}): SpellingWord => ({
  id: "w-receive",
  word: "receive",
  ar: "يستلم",
  level: "A2",
  category: "ie-ei",
  example: "Did you receive my email?",
  ...over,
});

const issuesOf = (words: SpellingWord[], required: string[] = []) => validateContent(words, required).issues;

describe("validateContent", () => {
  it("reports nothing for a valid bank and counts words by category and level", () => {
    const report = validateContent([word(), word({ id: "w-their", word: "their", category: "homophones", level: "A1", example: "Their house is big.", confusables: ["there"] })]);
    expect(report.issues).toEqual([]);
    expect(report.words).toBe(2);
    expect(report.byCategory["ie-ei"]).toBe(1);
    expect(report.byCategory.homophones).toBe(1);
    expect(report.byLevel).toMatchObject({ A1: 1, A2: 1, B1: 0 });
    expect(report.dictationSentences).toBe(2);
  });

  it("reports schema problems with the field path", () => {
    const issues = issuesOf([word({ ar: "receive" })]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatch(/^w-receive: schema: ar /);
  });

  it("requires the id to match the word, including apostrophes and hyphens", () => {
    expect(issuesOf([word({ id: "w-recieve" })])).toEqual(['w-recieve: id does not match the word "receive"']);
    expect(issuesOf([word({ id: "w-they-re", word: "they're", category: "homophones", example: "They're late.", confusables: ["their"] })])).toEqual([]);
  });

  it("reports duplicate ids and duplicate spellings (US or UK)", () => {
    const color = word({ id: "w-color", word: "color", uk: "colour", category: "british-american", example: "What color is it?" });
    expect(issuesOf([word(), word({ example: "I receive mail." })])).toContain("w-receive: duplicate id (also in ie-ei)");
    const clash = word({ id: "w-colour", word: "colour", category: "common", example: "Pick a colour now." });
    expect(issuesOf([color, clash])).toContain('w-colour: spelling "colour" duplicates w-color');
  });

  it("reports duplicate example sentences regardless of case", () => {
    const other = word({ id: "w-deceive", word: "deceive", example: "Did you DECEIVE my email?" });
    const dup = word({ id: "w-deceive", word: "deceive", example: "did you receive my email?" });
    expect(issuesOf([word(), other])).toEqual([]);
    expect(issuesOf([word(), dup]).some((i) => i.includes("example sentence duplicates w-receive"))).toBe(true);
  });

  it("requires the example to contain the word as a whole word", () => {
    expect(issuesOf([word({ example: "Did you get my email?" })])).toEqual(['w-receive: example does not contain "receive" as a whole word']);
    expect(issuesOf([word({ example: "Did you receives my email?" })])).toHaveLength(1);
    expect(issuesOf([word({ example: "Receive it, please." })])).toEqual([]);
  });

  it("checks variant, homophone and confusable rules", () => {
    expect(issuesOf([word({ uk: "receive" })])).toContain("w-receive: uk spelling equals the American one");
    expect(issuesOf([word({ category: "british-american" })])).toContain("w-receive: british-american word needs a uk spelling");
    expect(issuesOf([word({ category: "homophones" })])).toContain("w-receive: homophone needs confusables");
    expect(issuesOf([word({ category: "homophones", confusables: [] })])).toContain("w-receive: homophone needs confusables");
    expect(issuesOf([word({ confusables: ["receive"] })])).toContain("w-receive: confusable equals the word");
  });

  it("accepts a uk spelling up to 4 letters away and rejects one 5 away", () => {
    const color = (uk: string) => word({ id: "w-color", word: "color", uk, category: "british-american", example: "What color is it?" });
    expect(issuesOf([color("colour")])).toEqual([]);
    expect(issuesOf([word({ id: "w-airplane", word: "airplane", uk: "aeroplane", category: "british-american", example: "The airplane landed." })])).toEqual([]);
    expect(issuesOf([color("colourxyz")])).toEqual([]);
    expect(issuesOf([color("colourwxyz")])).toEqual(['w-color: uk spelling "colourwxyz" is not a variant of "color"']);
  });

  it("reports every V1 word id that is missing (orphaned SRS cards)", () => {
    expect(issuesOf([word()], ["w-receive", "w-people"])).toEqual(["w-people: V1 word is missing (its SRS cards would be orphaned)"]);
  });

  it("collects every problem in one run", () => {
    expect(issuesOf([word({ id: "w-x", uk: "receive", example: "Nothing here." })])).toHaveLength(3);
  });
});

describe("dictationSentences", () => {
  it(`keeps unique examples of at most ${DICTATION_MAX_WORDS} words`, () => {
    const twelve = `${Array.from({ length: DICTATION_MAX_WORDS - 1 }, () => "go").join(" ")} receive.`;
    const thirteen = `go ${twelve}`;
    const bank = [word({ example: twelve }), word({ id: "w-b", example: twelve }), word({ id: "w-c", example: thirteen })];
    expect(dictationSentences(bank)).toEqual([twelve]);
  });
});
