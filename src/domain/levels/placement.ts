import { LEVELS, type CefrLevel } from "../model";
import type { Rng } from "../shared/random";

/**
 * Adaptive spelling placement (DECISIONS E4). A staircase over the five
 * levels: a correct answer moves the estimate up, a wrong one moves it down.
 * The step starts at one whole level and halves at every change of direction
 * (never below half a level), so the test settles quickly near the learner's
 * level. 16 "pick the right spelling" items take about three minutes.
 */

export const PLACEMENT_ITEMS = 16;
const START = 1; // A2
const MIN_STEP = 0.5;
/** A level counts as passed with at least this share right over at least MIN_SEEN items. */
export const PASS_RATE = 0.6;
const MIN_SEEN = 2;

export interface PlacementAnswer {
  readonly wordId: string;
  readonly level: CefrLevel;
  readonly correct: boolean;
}

export interface PlacementState {
  /** Ability estimate on 0 (A1) … 4 (C1). */
  readonly theta: number;
  readonly step: number;
  /** +1 after a correct answer, -1 after a wrong one, 0 before the first. */
  readonly lastDir: -1 | 0 | 1;
  readonly answers: readonly PlacementAnswer[];
}

export const startPlacement = (): PlacementState => ({ theta: START, step: 1, lastDir: 0, answers: [] });

const clampIndex = (n: number) => Math.max(0, Math.min(LEVELS.length - 1, n));

/** The level of the next item. */
export const placementLevel = (s: PlacementState): CefrLevel => LEVELS[clampIndex(Math.round(s.theta))] ?? "A2";

export const placementDone = (s: PlacementState): boolean => s.answers.length >= PLACEMENT_ITEMS;

export function answerPlacement(s: PlacementState, a: PlacementAnswer): PlacementState {
  if (placementDone(s)) return s;
  const dir = a.correct ? 1 : -1;
  const step = s.lastDir !== 0 && s.lastDir !== dir ? Math.max(MIN_STEP, s.step / 2) : s.step;
  return {
    theta: Math.max(0, Math.min(LEVELS.length - 1, s.theta + dir * step)),
    step,
    lastDir: dir,
    answers: [...s.answers, a],
  };
}

export interface LevelTally {
  readonly level: CefrLevel;
  readonly correct: number;
  readonly total: number;
}

export interface PlacementResult {
  readonly level: CefrLevel;
  /** How the learner did at the result level (null when no item was at that level). */
  readonly at: LevelTally | null;
  /** How the learner did one level higher (null at C1 or when no item was there). */
  readonly above: LevelTally | null;
}

function tally(answers: readonly PlacementAnswer[], level: CefrLevel): LevelTally | null {
  const at = answers.filter((a) => a.level === level);
  return at.length === 0 ? null : { level, correct: at.filter((a) => a.correct).length, total: at.length };
}

/**
 * The result is the highest level the learner passed (≥ 60% right over at
 * least two items). With no level passed, the result is A1.
 */
export function placementResult(s: PlacementState): PlacementResult {
  let level: CefrLevel = "A1";
  for (const l of LEVELS) {
    const t = tally(s.answers, l);
    if (t && t.total >= MIN_SEEN && t.correct / t.total >= PASS_RATE) level = l;
  }
  const next = LEVELS[LEVELS.indexOf(level) + 1];
  return { level, at: tally(s.answers, level), above: next ? tally(s.answers, next) : null };
}

/** Picks an unused word at `level`, or the nearest level that still has one. */
export function pickPlacementWord<W extends { readonly id: string; readonly level: CefrLevel }>(
  words: readonly W[],
  level: CefrLevel,
  used: ReadonlySet<string>,
  rng: Rng,
): W | null {
  const i = LEVELS.indexOf(level);
  for (let d = 0; d < LEVELS.length; d += 1) {
    for (const l of [LEVELS[i - d], LEVELS[i + d]]) {
      if (!l) continue;
      const free = words.filter((w) => w.level === l && !used.has(w.id));
      if (free.length > 0) return free[Math.floor(rng() * free.length)] ?? null;
    }
  }
  return null;
}
