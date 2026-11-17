import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { LEVELS } from "@/domain/model";
import { dictationById, dictationMessages, dictationSchema, dictationSentences, scenarioById, scenarioSchema, scenarios } from "@/data/writing";
import { spellingWords } from "@/data/words";
import { checkText, isMistake, type Speller } from "@/domain/writing/check";
import { realSpeller } from "../helpers/speller";

/**
 * Sentences and messages content (phase F): schema, volume, no duplicates,
 * and every English text spell-checks clean with the real dictionary, which
 * also guards the checker against false positives on real, correct English.
 */

let speller: Speller;
beforeAll(() => {
  speller = realSpeller();
}, 30_000);

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
const dups = (xs: readonly string[]) => xs.filter((x, i) => xs.indexOf(x) !== i);

describe("writing content: schema and volume", () => {
  it("validates every scenario and dictation text against its schema", () => {
    for (const s of scenarios) expect(scenarioSchema.safeParse(s).success, s.id).toBe(true);
    for (const d of [...dictationSentences, ...dictationMessages]) expect(dictationSchema.safeParse(d).success, d.id).toBe(true);
  });

  it("has at least 150 scenarios, 300 sentences and 60 messages, spread over A1–C1", () => {
    expect(scenarios.length).toBeGreaterThanOrEqual(150);
    expect(dictationSentences.length).toBeGreaterThanOrEqual(300);
    expect(dictationMessages.length).toBeGreaterThanOrEqual(60);
    for (const level of LEVELS) {
      expect(scenarios.filter((s) => s.level === level).length, `scenarios ${level}`).toBeGreaterThanOrEqual(25);
      expect(dictationSentences.filter((s) => s.level === level).length, `sentences ${level}`).toBeGreaterThanOrEqual(40);
      expect(dictationMessages.filter((s) => s.level === level).length, `messages ${level}`).toBeGreaterThanOrEqual(10);
    }
  });

  it("offers every kind of free writing", () => {
    expect(new Set(scenarios.map((s) => s.kind))).toEqual(new Set(["sentence", "message", "email", "paragraph"]));
  });

  it("gives messages several sentences and keeps them longer than single sentences", () => {
    for (const m of dictationMessages) expect(m.sentences.length, m.id).toBeGreaterThanOrEqual(4);
  });
});

describe("writing content: no repeats", () => {
  it("has unique ids", () => {
    expect(scenarioById.size).toBe(scenarios.length);
    expect(dictationById.size).toBe(dictationSentences.length + dictationMessages.length);
  });

  it("has no duplicate prompts (Arabic or English)", () => {
    expect(dups(scenarios.map((s) => s.ar))).toEqual([]);
    expect(dups(scenarios.map((s) => normalize(s.en)))).toEqual([]);
  });

  it("has no duplicate dictation sentences anywhere (sentences and message lines)", () => {
    const all = [...dictationSentences, ...dictationMessages].flatMap((d) => d.sentences).map(normalize);
    // Short greetings and sign-offs may repeat across messages; real sentences may not.
    expect(dups(all.filter((s) => s.split(" ").length > 4))).toEqual([]);
  });

  it("does not reuse the word bank's example sentences (original, separate content)", () => {
    const examples = new Set(spellingWords.map((w) => normalize(w.example)));
    const reused = dictationSentences.flatMap((d) => d.sentences).filter((s) => examples.has(normalize(s)));
    expect(reused).toEqual([]);
  });
});

describe("writing content: spelling", () => {
  it("every dictation text and help word spell-checks clean (no false positives on correct English)", () => {
    const problems: string[] = [];
    const texts = [
      ...dictationSentences.flatMap((d) => d.sentences.map((s) => [d.id, s] as const)),
      ...dictationMessages.flatMap((d) => d.sentences.map((s) => [d.id, s] as const)),
      ...scenarios.map((s) => [s.id, s.en] as const),
      ...scenarios.flatMap((s) => (s.words ?? []).map((w) => [s.id, `${w}.`] as const)),
    ];
    for (const [id, text] of texts) {
      const issues = checkText(text, { speller }).issues.filter(isMistake);
      if (issues.length > 0) problems.push(`${id}: ${issues.map((i) => `${i.word}→${i.suggestion}`).join(", ")} in "${text}"`);
    }
    expect(problems).toEqual([]);
  }, 60_000);
});

describe("dictionary files", () => {
  it("ships the en-US Hunspell dictionary with its licence", () => {
    const pkg = JSON.parse(readFileSync("node_modules/dictionary-en/package.json", "utf8")) as { version: string; license: string };
    expect(pkg).toMatchObject({ version: "4.0.0", license: "(MIT AND BSD)" });
  });
});
