import { z } from "zod";
import { LEVELS, type CefrLevel } from "@/domain/model";
import { MESSAGES } from "./messages";
import type { DictPair } from "./pair";
import { SCENARIOS, type ScenarioKind } from "./scenarios";
import { SENTENCES_A1, SENTENCES_A2 } from "./sentences-a";
import { SENTENCES_B1, SENTENCES_B2, SENTENCES_C1 } from "./sentences-b";

/**
 * Sentences and messages content (phase F): free-writing scenarios, dictation
 * sentences and longer dictation messages, A1–C1. Original, written for this
 * project. Ids are `<prefix>-<level>-<n>`: append new items, never reorder.
 */

const english = z
  .string()
  .min(1)
  .refine((s) => /^[\x20-\x7E]+$/.test(s), "printable ASCII English")
  .refine((s) => s === s.trim() && !/\s{2,}/.test(s), "no stray spaces")
  .refine((s) => /[.?!]$/.test(s), "ends with . ? or !");

const arabic = z
  .string()
  .min(4)
  .refine((s) => /[؀-ۿ]/.test(s), "must contain Arabic")
  .refine((s) => !/[A-Za-z]/.test(s), "no Latin letters (RTL readability)");

export const SCENARIO_KINDS = ["sentence", "message", "email", "paragraph"] as const satisfies readonly ScenarioKind[];

export const scenarioSchema = z
  .object({
    id: z.string().regex(/^sc-(a1|a2|b1|b2|c1)-\d{3}$/),
    level: z.enum(LEVELS),
    kind: z.enum(SCENARIO_KINDS),
    ar: arabic,
    en: english,
    /** Suggested length in words. */
    minWords: z.number().int().min(3),
    words: z.array(z.string().regex(/^[A-Za-z][a-z' ]*$/)).max(6).optional(),
  })
  .strict();
export type Scenario = z.infer<typeof scenarioSchema>;

export const dictationSchema = z
  .object({
    id: z.string().regex(/^(ds|dm)-(a1|a2|b1|b2|c1)-\d{3}$/),
    level: z.enum(LEVELS),
    kind: z.enum(["sentence", "message"]),
    title: z.object({ ar: arabic, en: z.string().min(1) }).optional(),
    /** One sentence for a dictation sentence; several for a message (read one at a time). */
    sentences: z.array(english.refine((s) => s.length <= 160, "sentence ≤ 160 chars")).min(1).max(8),
    /** The Arabic translation of each sentence, in order: the meaning hint shown while the learner types. */
    ar: z.array(arabic).min(1).max(8),
  })
  .strict()
  .refine((d) => d.ar.length === d.sentences.length, "one Arabic translation per sentence");
export type DictationText = z.infer<typeof dictationSchema>;

const pad = (n: number) => String(n + 1).padStart(3, "0");
const lower = (l: CefrLevel) => l.toLowerCase();

/** Minimum words a free-writing answer should have, by kind and level. */
export function minWordsFor(kind: ScenarioKind, level: CefrLevel): number {
  const step = LEVELS.indexOf(level);
  switch (kind) {
    case "sentence":
      return 4 + step * 2;
    case "message":
      return 12 + step * 4;
    case "email":
      return 30 + step * 10;
    case "paragraph":
      return 35 + step * 12;
  }
}

export const scenarios: readonly Scenario[] = LEVELS.flatMap((level) =>
  SCENARIOS[level].map((sc, i) => ({
    id: `sc-${lower(level)}-${pad(i)}`,
    level,
    kind: sc.kind,
    ar: sc.ar,
    en: sc.en,
    minWords: minWordsFor(sc.kind, level),
    ...(sc.words ? { words: [...sc.words] } : {}),
  })),
);

const SENTENCES: Readonly<Record<CefrLevel, readonly DictPair[]>> = {
  A1: SENTENCES_A1,
  A2: SENTENCES_A2,
  B1: SENTENCES_B1,
  B2: SENTENCES_B2,
  C1: SENTENCES_C1,
};

export const dictationSentences: readonly DictationText[] = LEVELS.flatMap((level) =>
  SENTENCES[level].map(([text, ar], i) => ({ id: `ds-${lower(level)}-${pad(i)}`, level, kind: "sentence" as const, sentences: [text], ar: [ar] })),
);

export const dictationMessages: readonly DictationText[] = LEVELS.flatMap((level) =>
  MESSAGES[level].map((msg, i) => ({ id: `dm-${lower(level)}-${pad(i)}`, level, kind: "message" as const, title: msg.title, sentences: msg.sentences.map(([en]) => en), ar: msg.sentences.map(([, ar]) => ar) })),
);

export const scenarioById: ReadonlyMap<string, Scenario> = new Map(scenarios.map((s) => [s.id, s]));
export const dictationById: ReadonlyMap<string, DictationText> = new Map([...dictationSentences, ...dictationMessages].map((d) => [d.id, d]));
