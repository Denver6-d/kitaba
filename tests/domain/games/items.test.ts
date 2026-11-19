import { describe, expect, it } from "vitest";
import { blankedContext, buildItem, findWordToken, normalizeSentence, sentenceMatches } from "@/domain/games/items";
import { buildItems } from "@/domain/games/session";
import { seededRng } from "@/domain/shared/random";

const ctx = (seed = 1) => ({ accent: "us" as const, rng: seededRng(seed), bankSpellings: new Set(["receive", "their", "there", "color"]) });
const receive = { id: "w-receive", word: "receive", category: "ie-ei", example: "Did you receive my email?" };
const their = { id: "w-their", word: "their", category: "homophones", example: "Their house is big.", confusables: ["there", "they're"] };
const color = { id: "w-color", word: "color", uk: "colour", category: "british-american", example: "What color is your car?" };

describe("item builders", () => {
  it("speaks homophones with their example sentence", () => {
    expect(buildItem("listen", their, ctx(), "k")?.speak).toBe("their. Their house is big.");
    expect(buildItem("listen", receive, ctx(), "k")?.speak).toBe("receive");
  });

  it("asks for the learner's variant", () => {
    expect(buildItem("listen", color, { ...ctx(), accent: "uk" }, "k")?.answer).toBe("colour");
  });

  it("builds choice items with the answer and distinct wrong options", () => {
    const item = buildItem("choice", receive, ctx(), "k");
    expect(item?.options).toContain("receive");
    expect(new Set(item?.options).size).toBe(item?.options?.length);
    expect(item?.options?.length).toBeGreaterThanOrEqual(3);
  });

  it("uses confusables and a blanked sentence for homophones in choice mode", () => {
    const item = buildItem("choice", their, ctx(), "k");
    expect(item?.options).toEqual(expect.arrayContaining(["their", "there", "they're"]));
    expect(item?.context).toBe("____ house is big.");
  });

  it("builds a Fix the Mistake sentence with exactly one misspelled token", () => {
    const item = buildItem("fix", receive, ctx(), "k");
    expect(item?.kind).toBe("fix");
    const tokens = item?.tokens ?? [];
    const original = receive.example.split(" ");
    const changed = tokens.map((t, i) => (t !== original[i] ? i : -1)).filter((i) => i >= 0);
    expect(changed).toEqual([item?.wrongIndex]);
  });

  it("keeps a leading capital when replacing a word in a token", () => {
    const item = buildItem("fix", their, ctx(), "k");
    expect(item?.tokens?.[0]?.[0]).toMatch(/[A-Z]/);
  });

  it("builds missing-letter and scramble items", () => {
    expect(buildItem("missing", receive, ctx(), "k")?.masked).toMatch(/_/);
    expect(buildItem("scramble", receive, ctx(), "k")?.letters?.join("")).not.toBe("receive");
  });

  it("fills a mixed session in mode order with unique keys", () => {
    const items = buildItems(["listen", "choice"], [receive, their, color], ctx(), 3);
    expect(items.map((i) => i.mode)).toEqual(["listen", "choice", "listen"]);
    expect(new Set(items.map((i) => i.key)).size).toBe(3);
  });
});

describe("sentence dictation items", () => {
  // Regression: the length check split on the letter "s" (/s+/) instead of whitespace,
  // so long sentences without many s's were dictated and short ones full of s's were not.
  it("count words, not runs of the letter s", () => {
    const long = { ...receive, example: "Did you receive the email that I wrote to you on the morning of the third day?" };
    expect(buildItem("sentence", long, ctx(), "k")).toBeNull();
    const shortWithS = { ...receive, example: "Yes, she says this is his receive slot." };
    expect(buildItem("sentence", shortWithS, ctx(), "k")?.kind).toBe("sentence");
  });
});

describe("sentence helpers", () => {
  it("find a word token ignoring case and punctuation", () => {
    expect(findWordToken(["Their", "house"], "their")).toBe(0);
    expect(findWordToken(["is", "big."], "big")).toBe(1);
    expect(findWordToken(["theirs"], "their")).toBe(-1);
  });
  it("blank a word in context", () => {
    expect(blankedContext("I hear you.", "hear")).toBe("I ____ you.");
  });
  it("compare dictated sentences without case or punctuation", () => {
    expect(normalizeSentence("  Did you RECEIVE my email? ")).toBe("did you receive my email");
    expect(sentenceMatches("did you receive my email", "Did you receive my email?")).toBe(true);
    expect(sentenceMatches("did you recieve my email", "Did you receive my email?")).toBe(false);
  });
});
