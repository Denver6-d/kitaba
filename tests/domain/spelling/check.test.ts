import { describe, expect, it } from "vitest";
import { checkAnswer, expectedSpelling, normalizeAnswer } from "@/domain/spelling/check";
import { charDistance, letterDiff } from "@/domain/spelling/diff";

const colour = { word: "color", uk: "colour", category: "british-american" };
const centre = { word: "center", uk: "centre", category: "common" };

describe("checkAnswer", () => {
  it("normalises case, spaces and curly apostrophes", () => {
    expect(normalizeAnswer("  They’re ")).toBe("they're");
    expect(checkAnswer({ word: "they're", category: "homophones" }, "THEY’RE", "us").verdict).toBe("correct");
  });
  it("expects the learner's chosen variant", () => {
    expect(expectedSpelling(colour, "uk")).toBe("colour");
    expect(expectedSpelling(colour, "us")).toBe("color");
    expect(checkAnswer(colour, "colour", "uk").verdict).toBe("correct");
  });
  it("accepts the other variant with a note, except when the variant is the point", () => {
    expect(checkAnswer(centre, "centre", "us")).toMatchObject({ verdict: "other-variant", accepted: true, expected: "center" });
    expect(checkAnswer(colour, "colour", "us")).toMatchObject({ verdict: "wrong", accepted: false });
  });
  it("returns a letter diff for wrong answers", () => {
    const r = checkAnswer({ word: "receive", category: "ie-ei" }, "recieve", "us");
    expect(r.verdict).toBe("wrong");
    expect(r.diff.length).toBeGreaterThan(1);
  });
});

describe("letterDiff", () => {
  it("marks missing, extra and wrong letters in reading order", () => {
    expect(letterDiff("acomodate", "accommodate").filter((d) => d.kind !== "same")).toEqual([
      { kind: "missing", text: "c" },
      { kind: "missing", text: "m" },
    ]);
    expect(letterDiff("untill", "until")).toEqual([
      { kind: "same", text: "until" },
      { kind: "extra", text: "l" },
    ]);
    expect(letterDiff("seperate", "separate")).toEqual([
      { kind: "same", text: "sep" },
      { kind: "wrong", text: "e", expected: "a" },
      { kind: "same", text: "rate" },
    ]);
  });
  it("has as many edits as charDistance", () => {
    for (const [a, b] of [
      ["kitten", "sitting"],
      ["", "abc"],
      ["same", "same"],
      ["recieve", "receive"],
    ] as const) {
      const edits = letterDiff(a, b).reduce((n, s) => n + (s.kind === "same" ? 0 : s.text.length), 0);
      expect(edits).toBe(charDistance(a, b));
    }
  });
  it("rebuilds the expected word from the segments", () => {
    const segs = letterDiff("recieve", "receive");
    const rebuilt = segs.map((s) => (s.kind === "same" || s.kind === "missing" ? s.text : s.kind === "wrong" ? s.expected : "")).join("");
    expect(rebuilt).toBe("receive");
  });
});
