/** Spelling difficulty categories. Labels and rule explanations live in src/data/rules.ts. */
export const SPELLING_CATEGORIES = [
  "common",
  "homophones",
  "double-letters",
  "silent-letters",
  "ie-ei",
  "plurals",
  "verb-endings",
  "adverbs-ly",
  "prefixes",
  "suffixes",
  "british-american",
  "p-b",
  "v-f",
  "short-vowels",
  "vowel-confusion",
] as const;

export type SpellingCategoryId = (typeof SPELLING_CATEGORIES)[number];
