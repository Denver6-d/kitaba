import { describe, expect, it } from "vitest";
import { classify, homophoneGroups, type ClassifyContext } from "../../scripts/content/lib/classify.mjs";
import { levelFor } from "../../scripts/content/lib/levels.mjs";
import { parseCmu, parseVarcon } from "../../scripts/content/lib/sources.mjs";

/** The open-data word pipeline: VarCon and CMUdict parsing, levels and the rule-based categories. */

const CMU = `
their DH EH1 R
there DH EH1 R
there(2) DH ER0
knight N AY1 T
night N AY1 T
know N OW1
walk W AO1 K
chocolate CH AO1 K L AH0 T
science S AY1 AH0 N S
receive R AH0 S IY1 V
street S T R IY1 T
picture P IH1 K CH ER0 # a comment
`;
const cmu = parseCmu(CMU);
const LEX = new Set(["city", "cities", "stop", "stopped", "make", "making", "quick", "quickly", "happy", "unhappy", "know", "walk", "receive", "science", "street", "picture", "color", "chocolate", "knight", "night", "their", "there"]);
const ctx = (over: Partial<ClassifyContext> = {}): ClassifyContext => ({
  has: (w) => LEX.has(w),
  prons: (w) => cmu.get(w) ?? [],
  uk: (w) => (w === "color" ? "colour" : undefined),
  homophones: () => [],
  ...over,
});

describe("parseCmu", () => {
  it("merges alternative pronunciations and drops comments", () => {
    expect(cmu.get("there")).toEqual(["DH EH1 R", "DH ER0"]);
    expect(cmu.get("picture")).toEqual(["P IH1 K CH ER0"]);
  });
});

describe("parseVarcon", () => {
  it("keeps plain A/B pairs and skips senses written the same in both", () => {
    const text = [
      "# color <verified> (level 10)",
      "A Cv: color / B C: colour",
      "A Z: organize / B: organise",
      "A: absinthe / AV B: absinth | :1",
      "A B: absinthe | :2",
      "A: check / B: cheque | :1",
      "A B: check | :2",
    ].join("\n");
    const pairs = parseVarcon(text);
    expect(pairs.get("color")).toBe("colour");
    expect(pairs.get("organize")).toBe("organise");
    expect(pairs.has("absinthe")).toBe(false);
    expect(pairs.has("check")).toBe(false);
  });
});

describe("levelFor", () => {
  it("uses frequency bands and never puts a rare SCOWL word below B2", () => {
    expect(levelFor(1, 10)).toBe("A1");
    expect(levelFor(1500, 20)).toBe("A2");
    expect(levelFor(4000, 35)).toBe("B1");
    expect(levelFor(4000, 50)).toBe("B2");
    expect(levelFor(7000, 35)).toBe("B2");
    expect(levelFor(15000, 35)).toBe("C1");
  });
});

describe("classify", () => {
  it("assigns each spelling problem its category", () => {
    const c = ctx();
    expect(classify("color", c)).toBe("british-american");
    expect(classify("cities", c)).toBe("plurals");
    expect(classify("stopped", c)).toBe("verb-endings");
    expect(classify("making", c)).toBe("verb-endings");
    expect(classify("quickly", c)).toBe("adverbs-ly");
    expect(classify("unhappy", c)).toBe("prefixes");
    expect(classify("receive", c)).toBe("ie-ei");
    expect(classify("know", c)).toBe("silent-letters");
    expect(classify("walk", c)).toBe("silent-letters");
    expect(classify("chocolate", c)).toBe("short-vowels");
    expect(classify("street", c)).toBe("common");
    expect(classify("picture", c)).toBe("p-b");
  });

  it("does not call i-e in separate syllables an ie/ei word", () => {
    expect(classify("science", ctx())).not.toBe("ie-ei");
  });

  it("puts homophones first when the word has one", () => {
    expect(classify("knight", ctx({ homophones: (w) => (w === "knight" ? ["night"] : []) }))).toBe("homophones");
  });
});

describe("homophoneGroups", () => {
  it("pairs same-sounding spellings, but not British/American variants", () => {
    const table: Record<string, string[]> = { knight: ["N AY1 T"], night: ["N AY1 T"], color: ["K AH1 L ER0"], colour: ["K AH1 L ER0"] };
    const g = homophoneGroups(["knight", "night", "color", "colour"], (w) => table[w] ?? [], (a, b) => [a, b].sort().join() === "color,colour");
    expect(g.get("knight")).toEqual(["night"]);
    expect(g.get("night")).toEqual(["knight"]);
    expect(g.has("color")).toBe(false);
  });
});
