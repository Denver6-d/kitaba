import { describe, expect, it } from "vitest";
import { typingItemSchema, lessonSchema, sentenceSchema, spellingCategorySchema, spellingWordSchema } from "@/data/schema";
import { spellingWords } from "@/data/words";
import { diagnosticSentences, diagnosticWords } from "@/data/diagnostic";
import { commonWords, typingPhrases, typingSentences } from "@/data/typing";
import { lessons } from "@/data/lessons";

/** Content validator: data files must satisfy their schemas and basic integrity rules. */

const duplicates = (xs: readonly string[]) => xs.filter((x, i) => xs.indexOf(x) !== i);

describe("typing content", () => {
  it("every phrase and sentence matches the schema", () => {
    for (const item of [...typingPhrases, ...typingSentences]) {
      const r = typingItemSchema.safeParse(item);
      expect(r.success, `${item.id}: ${r.error?.message}`).toBe(true);
    }
  });
  it("has no duplicate ids or texts", () => {
    const all = [...typingPhrases, ...typingSentences];
    expect(duplicates(all.map((i) => i.id))).toEqual([]);
    expect(duplicates(all.map((i) => i.text.toLowerCase()))).toEqual([]);
  });
  it("covers every level", () => {
    for (const level of ["A1", "A2", "B1"]) {
      expect(typingSentences.some((s) => s.level === level)).toBe(true);
    }
  });
  it("common words are single printable words", () => {
    expect(commonWords.length).toBeGreaterThanOrEqual(150);
    for (const w of commonWords) expect(w).toMatch(/^[A-Za-z]+$/);
  });
});

describe("lessons", () => {
  it("match the schema, have unique ids and a contiguous order", () => {
    for (const l of lessons) {
      const r = lessonSchema.safeParse(l);
      expect(r.success, `${l.id}: ${r.error?.message}`).toBe(true);
    }
    expect(duplicates(lessons.map((l) => l.id))).toEqual([]);
    expect(lessons.map((l) => l.order)).toEqual(lessons.map((_, i) => i + 1));
  });
});


describe("spelling bank", () => {
  it("has at least 200 words", () => {
    expect(spellingWords.length).toBeGreaterThanOrEqual(200);
  });
  it("every word matches the schema and has a category", () => {
    for (const w of [...spellingWords, ...diagnosticWords]) {
      const r = spellingWordSchema.safeParse(w);
      expect(r.success, `${w.id}: ${r.error?.message}`).toBe(true);
      expect(spellingCategorySchema.options).toContain(w.category);
    }
  });
  it("has no duplicate ids or words", () => {
    expect(duplicates(spellingWords.map((w) => w.id))).toEqual([]);
    expect(duplicates(spellingWords.map((w) => w.word))).toEqual([]);
  });
  it("uses each word in its own example sentence", () => {
    for (const w of [...spellingWords, ...diagnosticWords]) {
      expect(w.example.toLowerCase(), w.id).toContain(w.word);
    }
  });
  it("covers every category with at least 10 words", () => {
    for (const c of spellingCategorySchema.options) {
      expect(spellingWords.filter((w) => w.category === c).length, c).toBeGreaterThanOrEqual(10);
    }
  });
});

describe("diagnostic sentences", () => {
  it("match the sentence schema and have accepted answers", () => {
    for (const s of diagnosticSentences) {
      expect(sentenceSchema.safeParse(s).success, s.id).toBe(true);
      expect(s.en.length).toBeGreaterThan(0);
    }
  });
});
