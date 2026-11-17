/** Practice levels are a motivation aid driven by XP (see xpForGame in domain/games/engine.ts). */

export interface LevelInfo {
  readonly level: number;
  readonly xpIntoLevel: number;
  readonly xpForNext: number;
  readonly progress: number;
}

/** Level n starts at 50·n·(n−1) XP: 0, 100, 300, 600, 1000, … */
const levelStart = (n: number): number => 50 * n * (n - 1);

export function levelInfo(xp: number): LevelInfo {
  const safe = Math.max(0, Math.floor(xp));
  let level = 1;
  while (levelStart(level + 1) <= safe) level += 1;
  const start = levelStart(level);
  const span = levelStart(level + 1) - start;
  const xpIntoLevel = safe - start;
  return { level, xpIntoLevel, xpForNext: span, progress: xpIntoLevel / span };
}
