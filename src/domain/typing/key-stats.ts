import type { Keystroke } from "./engine";

export interface KeyStat {
  readonly hits: number;
  readonly misses: number;
}

/** Per-key counters keyed by the lower-cased expected character. */
export type KeyStats = Readonly<Record<string, KeyStat>>;

export function keyStatsFromLog(log: readonly Keystroke[]): KeyStats {
  const out: Record<string, { hits: number; misses: number }> = {};
  for (const k of log) {
    if (k.kind !== "correct" && k.kind !== "error") continue;
    const key = k.expected.toLowerCase();
    if (!key) continue;
    const s = (out[key] ??= { hits: 0, misses: 0 });
    if (k.kind === "correct") s.hits += 1;
    else s.misses += 1;
  }
  return out;
}

export function mergeKeyStats(a: KeyStats, b: KeyStats): KeyStats {
  const out: Record<string, KeyStat> = { ...a };
  for (const [key, s] of Object.entries(b)) {
    const prev = out[key];
    out[key] = prev ? { hits: prev.hits + s.hits, misses: prev.misses + s.misses } : { ...s };
  }
  return out;
}

export function errorRate(s: KeyStat): number {
  const n = s.hits + s.misses;
  return n === 0 ? 0 : s.misses / n;
}

/**
 * Smoothed error rate. The prior (0.5 misses in 10 attempts) keeps keys with
 * few attempts from looking catastrophically weak after a single slip.
 */
export function weakness(s: KeyStat): number {
  return (s.misses + 0.5) / (s.hits + s.misses + 10);
}

const DRILLABLE = /^[a-z0-9.,;:'"?!-]$/;
export const MIN_ATTEMPTS_FOR_WEAKNESS = 5;

export function weakestKeys(stats: KeyStats, limit: number): string[] {
  return Object.entries(stats)
    .filter(([key, s]) => DRILLABLE.test(key) && s.misses > 0 && s.hits + s.misses >= MIN_ATTEMPTS_FOR_WEAKNESS)
    .sort(([ka, a], [kb, b]) => weakness(b) - weakness(a) || ka.localeCompare(kb))
    .slice(0, limit)
    .map(([key]) => key);
}
