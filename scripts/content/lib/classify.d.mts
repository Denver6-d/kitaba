export interface ClassifyContext {
  has(w: string): boolean;
  prons(w: string): string[];
  uk(w: string): string | undefined;
  homophones(w: string): string[];
}
export function phonemes(pron: string): string[];
export function classify(w: string, ctx: ClassifyContext): string;
export function homophoneGroups(words: Iterable<string>, prons: (w: string) => string[], isVariant: (a: string, b: string) => boolean): Map<string, string[]>;
