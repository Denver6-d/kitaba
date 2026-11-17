import { spellingWords } from "@/data/words";

/** Word-bank spellings (American and British): preferred among the checker's suggestions. */
export const bankWords: ReadonlySet<string> = new Set(spellingWords.flatMap((w) => (w.uk ? [w.word, w.uk] : [w.word])));

/**
 * American words whose British form depends on the meaning (a bank check / a cheque, a story / a storey,
 * a computer program / a TV programme, to practice / to practise): a British learner who writes the
 * American form may be right, so they never get a note.
 */
const AMBIGUOUS_FOR_UK = new Set(["check", "checks", "story", "stories", "program", "programs", "tire", "tires", "draft", "curb", "practice", "license", "meter", "meters"]);

/** American → British forms from the bank (color → colour), for notes to a British learner. */
export const ukForms: ReadonlyMap<string, string> = new Map(
  spellingWords.flatMap((w) => (w.uk && !AMBIGUOUS_FOR_UK.has(w.word) ? [[w.word, w.uk] as const] : [])),
);

/** Bank word id for a spelling (either variant), so a writing mistake on a bank word reuses its review card. */
export const bankIdBySpelling: ReadonlyMap<string, string> = new Map(spellingWords.flatMap((w) => (w.uk ? [[w.word, w.id] as const, [w.uk, w.id] as const] : [[w.word, w.id] as const])));
