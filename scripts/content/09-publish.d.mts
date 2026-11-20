export interface PipelineWord { word: string; uk?: string; level: string; category: string; rank: number; confusables?: string[]; fallback?: string }
export interface PublishedWordChunk { level: string; authors: string[]; examples: Record<string, [string, number] | [string, number, [number, string, number]]>; words: Record<string, Array<[string, number] | [string, number, Record<string, unknown>]>> }
export function wordChunks(words: PipelineWord[], level: string, o?: { examples?: Record<string, string>; exampleText?: Record<string, [string, string | null]>; exampleArabic?: Record<string, { id: number; text: string; author: string }>; hints?: Record<string, string>; budget?: number }): PublishedWordChunk[];
export function exampleArabicFrom(sentences: { chunks: Record<string, { authors: string[]; rows: unknown[][] }> }): Record<string, { id: number; text: string; author: string }>;
export function run(o?: { force?: boolean }): Promise<unknown>;
