import { LEVELS } from "@/domain/model";
import { SPELLING_CATEGORIES } from "@/domain/spelling/categories";
import { DICTATION_MAX_WORDS, findWordToken } from "@/domain/games/items";
import { charDistance } from "@/domain/spelling/diff";
import { CATEGORY_INFO } from "./rules";
import { spellingWordSchema, type SpellingWord } from "./schema";

/**
 * Content validation (run by `npm run validate:content` and the test suite).
 * Returns every problem found, so one run shows them all.
 */

export interface ContentReport {
  readonly issues: readonly string[];
  readonly words: number;
  readonly byCategory: Readonly<Record<string, number>>;
  readonly byLevel: Readonly<Record<string, number>>;
  readonly dictationSentences: number;
}

const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** Sentences suitable for dictation: unique example sentences of at most DICTATION_MAX_WORDS words. */
export function dictationSentences(words: readonly SpellingWord[]): string[] {
  return [...new Set(words.map((w) => w.example).filter((e) => wordCount(e) <= DICTATION_MAX_WORDS))];
}

export function validateContent(words: readonly SpellingWord[], requiredIds: readonly string[] = []): ContentReport {
  const issues: string[] = [];
  const seenIds = new Map<string, string>();
  const seenSpellings = new Map<string, string>();
  const seenExamples = new Map<string, string>();

  for (const w of words) {
    const r = spellingWordSchema.safeParse(w);
    if (!r.success) issues.push(`${w.id}: schema: ${r.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
    if (w.id !== `w-${w.word.replace(/[^a-z0-9]/g, "-")}`) issues.push(`${w.id}: id does not match the word "${w.word}"`);

    if (seenIds.has(w.id)) issues.push(`${w.id}: duplicate id (also in ${seenIds.get(w.id)})`);
    seenIds.set(w.id, w.category);

    for (const spelling of w.uk ? [w.word, w.uk] : [w.word]) {
      const other = seenSpellings.get(spelling);
      if (other && other !== w.id) issues.push(`${w.id}: spelling "${spelling}" duplicates ${other}`);
      seenSpellings.set(spelling, w.id);
    }

    const ex = w.example.toLowerCase();
    if (seenExamples.has(ex)) issues.push(`${w.id}: example sentence duplicates ${seenExamples.get(ex)}`);
    seenExamples.set(ex, w.id);

    if (findWordToken(w.example.split(" "), w.word) === -1) issues.push(`${w.id}: example does not contain "${w.word}" as a whole word`);
    if (w.uk !== undefined && w.uk === w.word) issues.push(`${w.id}: uk spelling equals the American one`);
    // A British form is a small change of the same word (colour/color, organise/organize, aeroplane/airplane).
    if (w.uk !== undefined && charDistance(w.uk, w.word) > 4)
      issues.push(`${w.id}: uk spelling "${w.uk}" is not a variant of "${w.word}"`);
    if (w.category === "british-american" && !w.uk) issues.push(`${w.id}: british-american word needs a uk spelling`);
    if (w.category === "homophones" && (!w.confusables || w.confusables.length === 0)) issues.push(`${w.id}: homophone needs confusables`);
    for (const c of w.confusables ?? []) if (c === w.word) issues.push(`${w.id}: confusable equals the word`);
  }

  for (const id of requiredIds) if (!seenIds.has(id)) issues.push(`${id}: V1 word is missing (its SRS cards would be orphaned)`);
  for (const c of SPELLING_CATEGORIES) {
    const info = CATEGORY_INFO[c];
    if (!info) issues.push(`category ${c}: no rule text`);
    else if (!/[؀-ۿ]/.test(info.trick.ar) || info.trick.en.trim() === "") issues.push(`category ${c}: no memory trick`);
  }

  const byCategory = Object.fromEntries(SPELLING_CATEGORIES.map((c) => [c, words.filter((w) => w.category === c).length]));
  const byLevel = Object.fromEntries(LEVELS.map((l) => [l, words.filter((w) => w.level === l).length]));
  return { issues, words: words.length, byCategory, byLevel, dictationSentences: dictationSentences(words).length };
}
