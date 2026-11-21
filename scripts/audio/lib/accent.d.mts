export type AccentClass = "us" | "uk" | "other";
export declare function classifyAccentLabel(label: string): AccentClass | null;
export declare function labelsForFile(wikitext: string, file: string): string[];
export declare function speakerAccent(votes: readonly (AccentClass | null)[], min?: number): AccentClass | null;
