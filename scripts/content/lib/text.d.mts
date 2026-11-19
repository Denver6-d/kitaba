export function lines(file: string, encoding?: BufferEncoding): AsyncGenerator<string>;
export function readLatin1Lines(file: string): string[];
export function spellChecker(): { correct(word: string): boolean; suggest(word: string): string[] };
export function noSuggestWords(): Set<string>;
export function loadBank(): Promise<Array<{ word: string; ar: string; level: string; example: string; category: string; uk?: string; confusables?: readonly string[] }>>;
export function loadBlocklist(): { words: Map<string, string>; sentences: Map<string, string> };
export function inflections(w: string): Set<string>;
export function wordTokens(sentence: string): string[];
