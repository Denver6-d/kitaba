import { LEVELS, type CefrLevel } from "../model";

/**
 * Levels ordered by distance from `level`: the level itself, then one below,
 * one above, two below… Easier words come first at each distance, so a small
 * pool widens towards words the learner is more likely to know.
 */
export function levelsByDistance(level: CefrLevel): CefrLevel[] {
  const i = LEVELS.indexOf(level);
  const out: CefrLevel[] = [level];
  for (let d = 1; d < LEVELS.length; d += 1) {
    const below = LEVELS[i - d];
    const above = LEVELS[i + d];
    if (below) out.push(below);
    if (above) out.push(above);
  }
  return out;
}

/**
 * The words a learner at `level` should practise: those at the level, widened
 * one level at a time (nearest first) only while fewer than `min` are found.
 * Returns the pool and the levels it uses.
 */
export function poolAtLevel<W extends { readonly level: CefrLevel }>(words: readonly W[], level: CefrLevel, min: number): { pool: W[]; levels: CefrLevel[] } {
  const levels: CefrLevel[] = [];
  let pool: W[] = [];
  for (const l of levelsByDistance(level)) {
    levels.push(l);
    pool = words.filter((w) => levels.includes(w.level));
    if (pool.length >= min) break;
  }
  return { pool, levels };
}

/** Short Arabic/English descriptions live in i18n; this only validates input. */
export const isCefrLevel = (v: unknown): v is CefrLevel => typeof v === "string" && (LEVELS as readonly string[]).includes(v);
