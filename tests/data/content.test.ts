import { describe, expect, it } from "vitest";
import { scenarios } from "@/data/scenarios";
import { checkMessage } from "@/domain/professional/checklist";
import { sentences } from "@/data/sentences";
import { gradeSentence } from "@/domain/sentences/grader";
import { normalize } from "@/domain/sentences/normalize";
import { scenarioSchema, typingItemSchema, lessonSchema, sentenceSchema, spellingCategorySchema, spellingWordSchema } from "@/data/schema";
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


describe("sentence bank", () => {
  it("has at least 150 sentences across all levels", () => {
    expect(sentences.length).toBeGreaterThanOrEqual(150);
    for (const level of ["A1", "A2", "B1"]) expect(sentences.filter((s) => s.level === level).length).toBeGreaterThanOrEqual(40);
  });
  it("every sentence has Arabic, at least one English answer and matches the schema", () => {
    for (const s of sentences) {
      const r = sentenceSchema.safeParse(s);
      expect(r.success, `${s.id}: ${r.error?.message}`).toBe(true);
      expect(s.en.length, s.id).toBeGreaterThanOrEqual(1);
    }
  });
  it("has no duplicate ids, Arabic prompts or answers within a sentence", () => {
    expect(duplicates(sentences.map((s) => s.id))).toEqual([]);
    expect(duplicates(sentences.map((s) => s.ar))).toEqual([]);
    for (const s of sentences) expect(duplicates(s.en.map(normalize)), s.id).toEqual([]);
  });
  it("model answers are written as proper sentences", () => {
    for (const s of sentences) {
      const model = s.en[0] ?? "";
      expect(model, s.id).toMatch(/^[A-Z]/);
      expect(model, s.id).toMatch(/[.?!]$/);
    }
  });
  it("every accepted answer is graded as correct", () => {
    for (const s of sentences) {
      for (const answer of s.en) expect(gradeSentence(answer, s.en).correct, `${s.id}: ${answer}`).toBe(true);
    }
  });
  it("most sentences offer more than one accepted answer", () => {
    const multi = sentences.filter((s) => s.en.length > 1).length;
    expect(multi / sentences.length).toBeGreaterThan(0.5);
  });
});

describe("scenarios", () => {
  it("has at least 8 valid scenarios with unique ids", () => {
    expect(scenarios.length).toBeGreaterThanOrEqual(8);
    expect(duplicates(scenarios.map((s) => s.id))).toEqual([]);
    for (const sc of scenarios) {
      const r = scenarioSchema.safeParse(sc);
      expect(r.success, `${sc.id}: ${r.error?.message}`).toBe(true);
      expect(sc.minWords).toBeLessThan(sc.maxWords);
    }
  });
  it("every model answer passes its own checklist", () => {
    for (const sc of scenarios) {
      const failed = checkMessage(sc.modelAnswer, sc).filter((c) => !c.passed).map((c) => c.id);
      expect(failed, sc.id).toEqual([]);
    }
  });
});
