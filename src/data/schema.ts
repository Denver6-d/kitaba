import { z } from "zod";
import { LEVELS } from "@/domain/model";
import { SPELLING_CATEGORIES } from "@/domain/spelling/categories";

/**
 * Content schemas. Every content file is validated against these by
 * `npm run validate:content` and tests/data/content.test.ts, so a typo in the
 * data fails the pipeline instead of breaking a game at runtime.
 */

export const levelSchema = z.enum(LEVELS);
export type Level = z.infer<typeof levelSchema>;

export const spellingCategorySchema = z.enum(SPELLING_CATEGORIES);
export type SpellingCategory = z.infer<typeof spellingCategorySchema>;

const lowerWord = z.string().regex(/^[a-z]+(?:['-][a-z]+)*$/, "lower-case English word");

const english = z
  .string()
  .min(1)
  .refine((s) => /^[\x20-\x7E]+$/.test(s), "must be printable ASCII English")
  .refine((s) => s === s.trim() && !/\s{2,}/.test(s), "no leading/trailing or double spaces");

const arabic = z
  .string()
  .min(1)
  .max(60)
  .refine((s) => /[؀-ۿ]/.test(s), "must contain Arabic")
  .refine((s) => !/[A-Za-z]/.test(s), "Arabic hint must not contain Latin letters");

export const spellingWordSchema = z
  .object({
    id: z.string().regex(/^w-[a-z0-9-]+$/, "id is w-<word>"),
    /** American spelling (the default). */
    word: lowerWord,
    /** British spelling, when it differs. */
    uk: lowerWord.optional(),
    /** Short Arabic meaning shown as a hint. */
    ar: arabic,
    level: levelSchema,
    category: spellingCategorySchema,
    /** An example sentence that contains the word; spoken for context and used in Fix the Mistake. */
    example: english.refine((s) => /[.?!]$/.test(s), "example ends with . ? or !").refine((s) => s.length <= 120, "example is short"),
    /** Words it is commonly confused with (homophones and near-homophones). */
    confusables: z.array(lowerWord).optional(),
  })
  .strict();
export type SpellingWord = z.infer<typeof spellingWordSchema>;
