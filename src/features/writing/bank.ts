import { spellingWords } from "@/data/words";

/** Word-bank spellings (American and British): preferred among the checker's suggestions. */
export const bankWords: ReadonlySet<string> = new Set(spellingWords.flatMap((w) => (w.uk ? [w.word, w.uk] : [w.word])));

/** American → British forms from the bank (color → colour). */
export const ukForms: ReadonlyMap<string, string> = new Map(spellingWords.flatMap((w) => (w.uk ? [[w.word, w.uk] as const] : [])));

/** Bank word id for a spelling (either variant), so a writing mistake on a bank word reuses its review card. */
export const bankIdBySpelling: ReadonlyMap<string, string> = new Map(spellingWords.flatMap((w) => (w.uk ? [[w.word, w.id] as const, [w.uk, w.id] as const] : [[w.word, w.id] as const])));
