import { describe, expect, it } from "vitest";
import { correctionRuns } from "@/domain/spelling/correction";
import { letterDiff } from "@/domain/spelling/diff";

const runs = (answer: string, expected: string) => correctionRuns(letterDiff(answer, expected), expected);
const rebuilt = (answer: string, expected: string) => runs(answer, expected).map((r) => r.text).join("");
const keys = (answer: string, expected: string) => runs(answer, expected).filter((r) => r.key).map((r) => r.text).join("|");

describe("correctionRuns: the correct word with the key letters marked", () => {
  it("always spells out exactly the correct word", () => {
    for (const [a, e] of [["recieve", "receive"], ["necesary", "necessary"], ["nife", "knife"], ["beautifull", "beautiful"], ["", "island"], ["island", "island"]] as const)
      expect(rebuilt(a, e), `${a} → ${e}`).toBe(e);
  });
  it("marks a missing letter", () => {
    expect(keys("necesary", "necessary")).toBe("s");
    expect(keys("nife", "knife")).toBe("k");
  });
  it("marks swapped or wrong letters", () => {
    expect(keys("recieve", "receive")).not.toBe("");
    expect(keys("definate", "definite")).toBe("i");
  });
  it("marks nothing when the learner only added a letter (the extra one is not in the right word)", () => {
    expect(keys("beautifull", "beautiful")).toBe("");
  });
  it("marks nothing when the answer is right or empty", () => {
    expect(keys("island", "island")).toBe("");
    expect(keys("", "island")).toBe("");
  });
});

describe("correctionRuns fallbacks", () => {
  it("shows the word plainly when the diff is empty (right spelling, wrong pick in fix-the-mistake)", () => {
    expect(correctionRuns([], "receive")).toEqual([{ text: "receive", key: false }]);
  });
  it("shows the word plainly when the diff was made against another form (the other US/UK spelling)", () => {
    expect(correctionRuns(letterDiff("colour", "colour"), "color")).toEqual([{ text: "color", key: false }]);
  });
});
