export declare const RAW_SECONDS: { min: number; max: number };
export declare const MAX_AUTHOR_WORDS: number;
export interface Candidate {
  title: string;
  kind: "en-us" | "lingualibre";
  speaker?: string;
}
export interface FileInfo {
  meta: Record<string, { value?: unknown } | undefined>;
  url: string;
  page: string;
  duration?: number;
  bytes?: number;
  mime?: string;
  wikitext?: string;
}
export interface Usable {
  title: string;
  kind: "en-us" | "lingualibre";
  url: string;
  page: string;
  author: string;
  license: string;
  licenseUrl: string;
}
export declare function chooseSources(word: string, candidates: readonly Candidate[], info: (title: string) => FileInfo | undefined): { usable: Usable[]; rejected: { title: string; reason: string }[] };
export declare function candidatesFor(
  word: string,
  ctx: {
    enUs: Map<string, string[]>;
    lingualibre: Map<string, { speaker: string; name: string }[]>;
    speakerAccent: (speaker: string) => string | null;
    speakerRank: (speaker: string) => number;
  },
): Candidate[];
