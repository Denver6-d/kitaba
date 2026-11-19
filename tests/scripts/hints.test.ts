import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hintProblems } from "../../scripts/content/06-hints.mjs";

/** The reviewed Arabic hint batches (step 06, DECISIONS OD11). */

const DIR = new URL("../../scripts/content/hints/", import.meta.url);
const batches = readdirSync(DIR)
  .filter((f) => /^batch-\d{2}\.json$/.test(f))
  .map((f) => ({ f, hints: (JSON.parse(readFileSync(new URL(f, DIR), "utf8")) as { hints: Record<string, string> }).hints }));

describe("hintProblems", () => {
  it("accepts a short Arabic hint with alternatives", () => {
    expect(hintProblems("يحصل على / يصبح")).toEqual([]);
  });
  it("rejects Latin letters, a missing Arabic word, length, stray spaces and empty alternatives", () => {
    expect(hintProblems("مثل like")).toContain("Latin letters");
    expect(hintProblems("123")).toContain("no Arabic letters");
    expect(hintProblems("ا".repeat(61))).toContain("longer than 60 characters");
    expect(hintProblems(" يأكل")).toContain("stray spaces");
    expect(hintProblems("يأكل / ")).toContain("stray spaces");
    expect(hintProblems("يأكل / / يشرب")).toContain("empty alternative");
    expect(hintProblems("")).toEqual(["empty"]);
  });
});

describe("hint batches", () => {
  it("are all valid, and each word is in one batch only", () => {
    const seen = new Map<string, string>();
    for (const { f, hints } of batches) {
      for (const [word, text] of Object.entries(hints)) {
        expect(hintProblems(text), `${word} in ${f}`).toEqual([]);
        expect(seen.get(word), `${word} in ${f} and ${seen.get(word)}`).toBeUndefined();
        seen.set(word, f);
      }
    }
    expect(seen.size).toBeGreaterThan(2000);
  });
});
