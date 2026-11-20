/**
 * Game engine: a pure reducer shared by every mode. Modes only build items;
 * scoring, combo, timing and the result live here. Times are injected (ms).
 */

/** What the learner is asked to do for one item. */
export type ItemKind =
  /** Type the word (listen, bee, missing, scramble, review). */
  | "typed"
  /** Pick one of several spellings. */
  | "choice"
  /** Tap the misspelled word in a sentence, then type it correctly. */
  | "fix"
  /** Type a whole dictated sentence. */
  | "sentence";

export type ItemMode = "listen" | "bee" | "fix" | "missing" | "scramble" | "choice" | "review" | "sentence";

export interface GameItem {
  /** Unique within a session. */
  readonly key: string;
  readonly wordId: string;
  readonly kind: ItemKind;
  /** The mode that built this item (a mixed session holds several). */
  readonly mode: ItemMode;
  /** The spelling (or sentence) that counts as correct, in the learner's variant. */
  readonly answer: string;
  /** Text to speak (listen-like items). */
  readonly speak?: string;
  /** Masked word for Missing Letters, e.g. "acc_mm_date". */
  readonly masked?: string;
  /** Shuffled letters for Word Scramble. */
  readonly letters?: readonly string[];
  /** Spellings to choose from (choice), one of which equals `answer`. */
  readonly options?: readonly string[];
  /** Sentence tokens (fix); `wrongIndex` is the misspelled token. */
  readonly tokens?: readonly string[];
  readonly wrongIndex?: number;
  /** Sentence shown with the word blanked, for homophones in choice mode. */
  readonly context?: string;
}

export interface ItemResult {
  readonly itemKey: string;
  readonly wordId: string;
  readonly correct: boolean;
  readonly answer: string;
  readonly ms: number;
  readonly points: number;
}

export interface GameConfig {
  /** Round length for timed modes (Spelling Bee); null = untimed. */
  readonly durationMs: number | null;
  /** Timed modes add a speed bonus per correct answer. */
  readonly speedBonus: boolean;
}

export interface GameState {
  readonly items: readonly GameItem[];
  readonly index: number;
  readonly results: readonly ItemResult[];
  readonly combo: number;
  readonly maxCombo: number;
  readonly points: number;
  readonly startedAt: number | null;
  readonly itemShownAt: number | null;
  readonly finishedAt: number | null;
  readonly config: GameConfig;
}

export type GameAction =
  /** The first interaction starts the clock (for timed modes, the round). */
  | { readonly type: "start"; readonly t: number }
  | { readonly type: "answer"; readonly itemKey: string; readonly correct: boolean; readonly answer: string; readonly t: number }
  | { readonly type: "next"; readonly t: number }
  | { readonly type: "tick"; readonly t: number }
  | { readonly type: "finish"; readonly t: number };

export const BASE_POINTS = 10;

/** Combo multiplier after `combo` correct answers in a row (this one included). */
export function multiplierFor(combo: number): number {
  if (combo >= 10) return 4;
  if (combo >= 6) return 3;
  if (combo >= 3) return 2;
  return 1;
}

/** Speed bonus for timed modes: fast correct answers earn up to 5 points (not multiplied). */
export function speedBonusFor(ms: number): number {
  if (ms < 3000) return 5;
  if (ms < 5000) return 3;
  if (ms < 8000) return 1;
  return 0;
}

export function createGame(items: readonly GameItem[], config: GameConfig): GameState {
  return { items, index: 0, results: [], combo: 0, maxCombo: 0, points: 0, startedAt: null, itemShownAt: null, finishedAt: null, config };
}

export const currentItem = (s: GameState): GameItem | undefined => (s.finishedAt === null ? s.items[s.index] : undefined);
export const isAnswered = (s: GameState, itemKey: string): boolean => s.results.some((r) => r.itemKey === itemKey);

export function remainingMs(s: GameState, t: number): number | null {
  if (s.config.durationMs === null) return null;
  if (s.startedAt === null) return s.config.durationMs;
  return Math.max(0, s.startedAt + s.config.durationMs - t);
}

export function reduceGame(s: GameState, a: GameAction): GameState {
  if (s.finishedAt !== null) return s;
  switch (a.type) {
    case "start":
      return s.startedAt === null ? { ...s, startedAt: a.t, itemShownAt: a.t } : s;
    case "answer": {
      const item = s.items[s.index];
      if (!item || item.key !== a.itemKey || isAnswered(s, a.itemKey)) return s;
      const started = s.startedAt ?? a.t;
      if (s.config.durationMs !== null && a.t - started > s.config.durationMs) return { ...s, finishedAt: started + s.config.durationMs };
      const shownAt = s.itemShownAt ?? started;
      const ms = Math.max(0, a.t - shownAt);
      const combo = a.correct ? s.combo + 1 : 0;
      const points = a.correct ? BASE_POINTS * multiplierFor(combo) + (s.config.speedBonus ? speedBonusFor(ms) : 0) : 0;
      return {
        ...s,
        startedAt: started,
        results: [...s.results, { itemKey: a.itemKey, wordId: item.wordId, correct: a.correct, answer: a.answer, ms, points }],
        combo,
        maxCombo: Math.max(s.maxCombo, combo),
        points: s.points + points,
      };
    }
    case "next": {
      const item = s.items[s.index];
      if (!item || !isAnswered(s, item.key)) return s;
      if (s.index + 1 >= s.items.length) return { ...s, finishedAt: a.t };
      return { ...s, index: s.index + 1, itemShownAt: a.t };
    }
    case "tick": {
      const left = remainingMs(s, a.t);
      return left === 0 && s.startedAt !== null && s.config.durationMs !== null ? { ...s, finishedAt: s.startedAt + s.config.durationMs } : s;
    }
    case "finish":
      return { ...s, finishedAt: a.t };
  }
}

export interface GameSummary {
  readonly answered: number;
  readonly correct: number;
  readonly accuracy: number;
  readonly points: number;
  readonly maxCombo: number;
  readonly seconds: number;
  readonly missed: readonly string[];
}

export function summarize(s: GameState): GameSummary {
  const answered = s.results.length;
  const correct = s.results.filter((r) => r.correct).length;
  const end = s.finishedAt ?? s.startedAt ?? 0;
  return {
    answered,
    correct,
    accuracy: answered === 0 ? 0 : correct / answered,
    points: s.points,
    maxCombo: s.maxCombo,
    seconds: s.startedAt === null ? 0 : Math.max(0, Math.round((end - s.startedAt) / 1000)),
    missed: [...new Set(s.results.filter((r) => !r.correct).map((r) => r.wordId))],
  };
}

/** Stars for a finished stage: 1 at ≥ 60% (boss 70%), 2 at ≥ 80%, 3 at ≥ 95%. */
export function starsFor(accuracy: number, answered: number, boss = false): number {
  if (answered === 0) return 0;
  if (accuracy >= 0.95) return 3;
  if (accuracy >= 0.8) return 2;
  if (accuracy >= (boss ? 0.7 : 0.6)) return 1;
  return 0;
}

/**
 * Stars for a timed round (Spelling Bee): accuracy alone would let one correct
 * word and a run-out clock earn three stars, so it also needs enough correct
 * words: 10 for one star, 15 for two, 20 for three.
 */
export function starsForTimed(accuracy: number, correct: number): number {
  const byCount = correct >= 20 ? 3 : correct >= 15 ? 2 : correct >= 10 ? 1 : 0;
  return Math.min(starsFor(accuracy, correct), byCount);
}

/** XP for a finished game: 3 per correct word, 1 per attempt that missed, 5 per star. */
export function xpForGame(summary: GameSummary, stars: number): number {
  return summary.correct * 3 + (summary.answered - summary.correct) + stars * 5;
}

/** What the learner needs for the next star (DESIGN.md V3, stage result). Null once all three are earned. */
export type NextStarGoal =
  | { readonly star: 1 | 2 | 3; readonly kind: "accuracy"; readonly percent: number }
  | { readonly star: 1 | 2 | 3; readonly kind: "words"; readonly words: number; readonly percent: number };

export function nextStarGoal(stars: number, opts: { boss?: boolean; timed?: boolean } = {}): NextStarGoal | null {
  if (stars >= 3) return null;
  const star = (Math.max(0, stars) + 1) as 1 | 2 | 3;
  const percent = star === 3 ? 95 : star === 2 ? 80 : opts.boss ? 70 : 60;
  // Timed rounds ignore the boss threshold, like starsForTimed.
  if (opts.timed) return { star, kind: "words", words: star === 3 ? 20 : star === 2 ? 15 : 10, percent: star === 1 ? 60 : percent };
  return { star, kind: "accuracy", percent };
}
