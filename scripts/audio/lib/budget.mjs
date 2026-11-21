/**
 * The size budget for the pronunciation audio (DECISIONS AU8), checked by
 * 08-publish and by tests/data/audio.test.ts.
 *
 * A word is about 0.4-0.9 s of speech at 32 kbps mono: 2-4 KB. The 5,074 words
 * with their own Arabic hint come to about 14 MB; the budget leaves room for
 * the fallback-hint tier of a later session.
 */
export const BUDGET = {
  /** One file: 2.6 s (the longest accepted word) at 32 kbps is about 10.4 KB. */
  maxFileBytes: 12_000,
  /** Average per file. */
  maxAverageBytes: 4_000,
  /** Everything under public/audio/v1. */
  totalBytes: 30_000_000,
};
