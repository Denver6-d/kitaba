import { describe, expect, it } from "vitest";
import { compareDictation, dictationWords } from "@/domain/writing/dictation";
import { classifyMistake } from "@/domain/writing/classify";
import { summarizeWriting } from "@/domain/writing/summary";
import { americanCandidates, britishToAmerican } from "@/domain/writing/british";

describe("dictationWords", () => {
  it("drops punctuation, keeps apostrophes and digits, and treats hyphens as spaces", () => {
    expect(dictationWords("“Hello,” she said — it’s 5 o'clock, a well-known time!")).toEqual(["Hello", "she", "said", "it's", "5", "o'clock", "a", "well", "known", "time"]);
  });
});

describe("compareDictation", () => {
  it("is all correct when only case and punctuation differ", () => {
    const r = compareDictation("Please close the door.", "please close the door");
    expect(r).toMatchObject({ words: 4, correct: 4, mistakes: 0, accuracy: 1 });
  });

  it("aligns a misspelled word with the right one and names the mistake", () => {
    const r = compareDictation("I received your message.", "I recieved your mesage");
    expect(r.segments).toEqual([
      { kind: "ok", word: "I", typed: "I" },
      { kind: "wrong", word: "received", typed: "recieved", type: "ie-ei" },
      { kind: "ok", word: "your", typed: "your" },
      { kind: "wrong", word: "message", typed: "mesage", type: "double" },
    ]);
    expect(r.accuracy).toBe(0.5);
  });

  it("reports missing and extra words", () => {
    const r = compareDictation("We are very tired today.", "We are tired the today");
    expect(r.segments.map((s) => s.kind)).toEqual(["ok", "ok", "missing", "ok", "extra", "ok"]);
    expect(r).toMatchObject({ words: 5, correct: 4, mistakes: 2 });
  });

  it("counts a homophone as a wrong word", () => {
    const r = compareDictation("Their house is big.", "There house is big.");
    expect(r.segments[0]).toMatchObject({ kind: "wrong", word: "Their", typed: "There" });
  });

  it("accepts a British spelling with a note", () => {
    const r = compareDictation("My favorite color is blue.", "My favourite colour is blue.");
    expect(r.correct).toBe(5);
    expect(r.segments.filter((s) => s.kind === "ok" && s.note === "british")).toHaveLength(2);
  });

  it("handles an empty answer and an empty text", () => {
    expect(compareDictation("Hello there.", "")).toMatchObject({ correct: 0, mistakes: 2, accuracy: 0 });
    expect(compareDictation("", "hi")).toMatchObject({ words: 0, accuracy: 0, mistakes: 1 });
  });

  it("treats apostrophes as part of the spelling", () => {
    const r = compareDictation("I don't know.", "I dont know.");
    expect(r.segments[1]).toMatchObject({ kind: "wrong", type: "apostrophe" });
  });
});

describe("classifyMistake", () => {
  it.each([
    ["recieve", "receive", "ie-ei"],
    ["adress", "address", "double"],
    ["untill", "until", "double"],
    ["nife", "knife", "silent"],
    ["rite", "write", "silent"],
    ["clim", "climb", "silent"],
    ["nite", "night", "other"],
    ["seperate", "separate", "vowel"],
    ["broblem", "problem", "p-b"],
    ["fery", "very", "v-f"],
    ["teh", "the", "order"],
    ["dont", "don't", "apostrophe"],
    ["alot", "a lot", "split"],
    ["monday", "Monday", "capital"],
    ["finaly", "finally", "double"],
    ["walkd", "walked", "vowel"],
    ["xyz", "house", "other"],
  ])("%s → %s is %s", (wrong, right, type) => {
    expect(classifyMistake(wrong, right)).toBe(type);
  });
});

describe("british", () => {
  const words = new Set(["color", "favorite", "center", "organize", "traveled", "license", "catalog", "gray", "analyze", "realization"]);
  const isWord = (w: string) => words.has(w);
  it.each([
    ["colour", "color"],
    ["favourite", "favorite"],
    ["centre", "center"],
    ["organise", "organize"],
    ["travelled", "traveled"],
    ["licence", "license"],
    ["catalogue", "catalog"],
    ["grey", "gray"],
    ["analyse", "analyze"],
    ["realisation", "realization"],
  ])("%s → %s", (uk, us) => {
    expect(britishToAmerican(uk, isWord)).toBe(us);
  });
  it("returns null for words that are not British forms", () => {
    expect(britishToAmerican("tabel", isWord)).toBeNull();
    expect(americanCandidates("color")).toEqual([]);
  });
});

describe("summarizeWriting", () => {
  it("computes accuracy, counts by type, distinct words to practise, stars and XP", () => {
    const s = summarizeWriting(20, [
      { wrong: "recieve", right: "receive", type: "ie-ei" },
      { wrong: "Recieve", right: "Receive", type: "ie-ei" },
      { wrong: "adress", right: "address", type: "double" },
    ]);
    expect(s).toMatchObject({ words: 20, mistakes: 3, accuracy: 0.85, byType: { "ie-ei": 2, double: 1 }, stars: 2 });
    expect(s.practice.map((p) => p.right)).toEqual(["receive", "address"]);
    expect(s.xp).toBe(17 + 10);
  });

  it("gives no stars to a text that is too short, and caps XP", () => {
    expect(summarizeWriting(2, []).stars).toBe(0);
    expect(summarizeWriting(500, []).xp).toBe(60 + 15);
    expect(summarizeWriting(0, []).accuracy).toBe(0);
  });
});
