import { z } from "zod";

/**
 * Content schemas. Every content file is validated against these in
 * tests/data/content.test.ts, so a typo in the data fails the build pipeline
 * instead of breaking a lesson at runtime.
 */

export const levelSchema = z.enum(["A1", "A2", "B1"]);
export type Level = z.infer<typeof levelSchema>;

const english = z
  .string()
  .min(1)
  .refine((s) => /^[\x20-\x7E]+$/.test(s), "must be printable ASCII English")
  .refine((s) => s === s.trim() && !/\s{2,}/.test(s), "no leading/trailing or double spaces");
const arabic = z
  .string()
  .min(1)
  .refine((s) => /[؀-ۿ]/.test(s), "must contain Arabic");
const id = z.string().regex(/^[a-z0-9-]+$/, "kebab-case id");

export const typingItemSchema = z.object({
  id,
  kind: z.enum(["phrase", "sentence"]),
  text: english,
  ar: arabic,
  level: levelSchema,
});
export type TypingItem = z.infer<typeof typingItemSchema>;

export const lessonSchema = z.object({
  id,
  order: z.number().int().positive(),
  keys: z.string().min(1),
  titleAr: arabic,
  titleEn: english,
  noteAr: arabic,
  noteEn: english,
  drills: z.array(english).min(3),
});
export type Lesson = z.infer<typeof lessonSchema>;

export const spellingCategorySchema = z.enum([
  "vowel-confusion",
  "double-letters",
  "silent-letters",
  "p-b",
  "v-f",
  "homophones",
  "suffixes",
  "ie-ei",
  "schwa",
  "consonant-clusters",
  "c-k-s",
  "final-e",
]);
export type SpellingCategory = z.infer<typeof spellingCategorySchema>;

export const spellingWordSchema = z.object({
  id,
  word: z.string().regex(/^[a-z]+(?:[-'][a-z]+)?$/, "lower-case word"),
  ar: arabic,
  level: levelSchema,
  category: spellingCategorySchema,
  /** A short example sentence to give the spoken word context (homophones need this). */
  example: english,
});
export type SpellingWord = z.infer<typeof spellingWordSchema>;

export const sentenceSchema = z.object({
  id,
  ar: arabic,
  /** Accepted English answers. The first one is the model answer shown to the learner. */
  en: z.array(english).min(1),
  /** Also accepted (e.g. British forms) but never shown, since the app teaches American English. */
  alsoAccept: z.array(english).optional(),
  level: levelSchema,
  topic: z.string().min(1),
});
export type Sentence = z.infer<typeof sentenceSchema>;

export const mustMentionSchema = z.object({
  labelAr: arabic,
  labelEn: english,
  /** Lower-case keywords; the check passes if any one appears. */
  anyOf: z.array(z.string().min(1)).min(1),
});

export const scenarioSchema = z.object({
  id,
  level: levelSchema,
  titleAr: arabic,
  titleEn: english,
  briefAr: arabic,
  briefEn: english,
  minWords: z.number().int().positive(),
  maxWords: z.number().int().positive(),
  mustMention: z.array(mustMentionSchema),
  modelAnswer: z.string().min(40),
});
export type Scenario = z.infer<typeof scenarioSchema>;
