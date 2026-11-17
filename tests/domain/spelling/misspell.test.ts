import { describe, expect, it } from "vitest";
import { maskWord, misspellingCandidates, misspellings, scramble, trickyPositions } from "@/domain/spelling/misspell";
import { seededRng } from "@/domain/shared/random";

describe("misspellings", () => {
  it("uses the category's own mistake patterns", () => {
    expect(misspellingCandidates({ word: "receive", category: "ie-ei" })).toContain("recieve");
    expect(misspellingCandidates({ word: "accommodate", category: "double-letters" })).toEqual(expect.arrayContaining(["acommodate", "accomodate"]));
    expect(misspellingCandidates({ word: "knee", category: "silent-letters" })).toContain("nee");
    expect(misspellingCandidates({ word: "problem", category: "p-b" })).toContain("broblem");
    expect(misspellingCandidates({ word: "very", category: "v-f" })).toContain("fery");
    expect(misspellingCandidates({ word: "stopping", category: "verb-endings" })).toContain("stoping");
    expect(misspellingCandidates({ word: "babies", category: "plurals" })).toContain("babys");
    expect(misspellingCandidates({ word: "dissatisfied", category: "prefixes" })).toContain("disatisfied");
    expect(misspellingCandidates({ word: "visible", category: "suffixes" })).toContain("visable");
    expect(misspellingCandidates({ word: "color", category: "british-american" })).toContain("colour");
    expect(misspellingCandidates({ word: "because", category: "short-vowels" })).toContain("bcause");
  });

  it("never returns the word, its accepted variant or a word to avoid", () => {
    const out = misspellings({ word: "center", uk: "centre", category: "common" }, 10, seededRng(3), new Set(["centers"]));
    expect(out.length).toBeGreaterThan(0);
    expect(out).not.toContain("center");
    expect(out).not.toContain("centre");
    expect(out).not.toContain("centers");
    expect(new Set(out).size).toBe(out.length);
  });

  it("offers the other variant as wrong only when the variant is being tested", () => {
    expect(misspellings({ word: "color", uk: "colour", category: "british-american" }, 5, seededRng(1))).toContain("colour");
  });

  it("finds letters worth blanking and masks them", () => {
    const pos = trickyPositions({ word: "receive", category: "ie-ei" });
    expect(pos.length).toBeGreaterThan(0);
    expect(pos.length).toBeLessThanOrEqual(2);
    expect(maskWord("receive", pos)).toMatch(/_/);
    expect(maskWord("cat", [1])).toBe("c_t");
  });

  it("scrambles letters without spelling the word", () => {
    for (let seed = 0; seed < 20; seed += 1) {
      const s = scramble("people", seededRng(seed));
      expect(s.join("")).not.toBe("people");
      expect([...s].sort().join("")).toBe([..."people"].sort().join(""));
    }
  });
});
