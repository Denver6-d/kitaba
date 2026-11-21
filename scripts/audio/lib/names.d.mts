export declare const AUDIO_EXT: RegExp;
type Listed = { name: string };
export declare function prefixedByWord(files: readonly Listed[], prefix: string, words: ReadonlySet<string>): Map<string, string[]>;
export declare function lingualibreByWord(files: readonly Listed[], words: ReadonlySet<string>): Map<string, { speaker: string; name: string }[]>;
