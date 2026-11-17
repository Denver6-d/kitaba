/** Practice levels are a motivation aid driven by XP; CEFR placement (A1–B1) comes from the diagnostic. */

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

export type XpActivity =
  | { readonly kind: "typing-test"; readonly chars: number; readonly accuracy: number }
  | { readonly kind: "spelling"; readonly correct: boolean }
  | { readonly kind: "sentence"; readonly score: number }
  | { readonly kind: "scenario"; readonly passed: number; readonly total: number };

export function xpFor(a: XpActivity): number {
  switch (a.kind) {
    case "typing-test": {
      const base = Math.round(a.chars / 10);
      return a.accuracy < 80 ? Math.floor(base / 2) : base;
    }
    case "spelling":
      return a.correct ? 3 : 1;
    case "sentence":
      return Math.round(2 + 6 * Math.max(0, Math.min(1, a.score)));
    case "scenario":
      return a.total === 0 ? 0 : Math.round((20 * a.passed) / a.total);
  }
}
