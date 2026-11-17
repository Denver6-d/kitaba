/**
 * Persisted records (schema v2, spelling pivot). Every synced record carries
 * an id, an updatedAt timestamp (ms) and an optional deletedAt tombstone; the
 * sync merge rules in domain/sync/merge.ts rely on these.
 */

export const LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;
export type CefrLevel = (typeof LEVELS)[number];

/** "mixed" = boss stages and the daily challenge (items from several modes). */
export const GAME_MODES = ["listen", "bee", "fix", "missing", "scramble", "choice", "review", "mixed"] as const;
export type GameMode = (typeof GAME_MODES)[number];

export interface SyncRecord {
  readonly id: string;
  readonly updatedAt: number;
  readonly deletedAt?: number;
}

/** Spaced-repetition card for a spelling word. id = word id. */
export interface SrsCardRecord extends SyncRecord {
  readonly wordId: string;
  readonly ease: number;
  readonly interval: number;
  readonly reps: number;
  readonly lapses: number;
  readonly due: number;
  readonly lastReviewed: number;
  /** For a word that is not in the word bank (misspelled in free writing or dictation): its spelling. */
  readonly word?: string;
  /** The sentence the mistake came from (sentences and messages), shown and spoken in review. */
  readonly context?: string;
}

/** How well an item is known; drives Arabic hint fading. id = "spell:<wordId>". */
export interface MasteryRecord extends SyncRecord {
  readonly mastery: number;
}

/**
 * "legacy" marks practice from V1 features that no longer exist (typing,
 * lessons, sentences…). It still counts for streak days and XP.
 */
export type ActivityKind = "spelling" | "game" | "review" | "writing" | "legacy";

/** One practice event: feeds streaks, daily goal and XP. Append-only. */
export interface ActivityRecord extends SyncRecord {
  readonly kind: ActivityKind;
  readonly at: number;
  readonly day: string;
  readonly seconds: number;
  readonly xp: number;
}

/** id = achievement id. */
export interface AchievementRecord extends SyncRecord {
  readonly unlockedAt: number;
}

/**
 * The learner's three levels (DECISIONS E2): word games (free play and campaign
 * stages), sentences and messages, and tests (daily challenge and boss stages).
 */
export interface LearnerLevels {
  readonly words: CefrLevel;
  readonly sentences: CefrLevel;
  readonly tests: CefrLevel;
}

export type LevelArea = keyof LearnerLevels;
export const LEVEL_AREAS: readonly LevelArea[] = ["words", "sentences", "tests"];

/** How the levels were set. null = never: the welcome screen is shown. */
export const LEVEL_SOURCES = ["choice", "placement", "skip"] as const;
export type LevelSource = (typeof LEVEL_SOURCES)[number];

export const DEFAULT_LEVEL: CefrLevel = "A2";

/** id = "me". */
export interface ProfileRecord extends SyncRecord {
  readonly levels: LearnerLevels;
  readonly levelSource: LevelSource | null;
  /** When the levels were last set by a choice or the placement test (0 = never). */
  readonly levelsAt: number;
  readonly dailyGoalMinutes: number;
}

export const sameLevels = (l: CefrLevel): LearnerLevels => ({ words: l, sentences: l, tests: l });

/** One finished game (append-only). */
export interface SessionRecord extends SyncRecord {
  readonly mode: GameMode;
  /** Campaign stage id, "daily:YYYY-MM-DD", or null for free play. */
  readonly stageId: string | null;
  readonly items: number;
  readonly correct: number;
  readonly points: number;
  readonly maxCombo: number;
  readonly seconds: number;
  readonly at: number;
  /** Word ids answered wrongly (capped). */
  readonly missed: readonly string[];
}

/** Best result for a campaign stage or daily challenge. id = stage id. */
export interface StageRecord extends SyncRecord {
  readonly stars: number;
  readonly bestPoints: number;
  /** First time the stage was cleared (≥ 1 star). */
  readonly clearedAt: number;
}

/** One mistake in a writing record. */
export interface WritingMiss {
  readonly wrong: string;
  readonly right: string | null;
  readonly type: string;
}

/** One finished free-writing text or dictation (append-only). Feeds "My progress". */
export interface WritingRecord extends SyncRecord {
  readonly mode: "free" | "dictation";
  /** Scenario or dictation id. */
  readonly sourceId: string;
  readonly level: CefrLevel;
  /** What the learner wrote (capped at WRITING_TEXT_MAX characters). */
  readonly text: string;
  readonly words: number;
  readonly mistakes: number;
  /** 0–1. */
  readonly accuracy: number;
  readonly stars: number;
  readonly at: number;
  readonly missed: readonly WritingMiss[];
}

export const WRITING_TEXT_MAX = 4000;
export const WRITING_MISSED_MAX = 50;

/** A word the learner added to their own dictionary. id = the word in lower case; removal is a tombstone. */
export interface DictionaryRecord extends SyncRecord {
  readonly word: string;
}

export interface TableMap {
  readonly srs: SrsCardRecord;
  readonly mastery: MasteryRecord;
  readonly activity: ActivityRecord;
  readonly achievements: AchievementRecord;
  readonly profile: ProfileRecord;
  readonly sessions: SessionRecord;
  readonly stages: StageRecord;
  readonly writings: WritingRecord;
  readonly dictionary: DictionaryRecord;
}

export type TableName = keyof TableMap;

export const TABLE_NAMES: readonly TableName[] = ["srs", "mastery", "activity", "achievements", "profile", "sessions", "stages", "writings", "dictionary"];

export const DEFAULT_PROFILE: ProfileRecord = {
  id: "me",
  updatedAt: 0,
  levels: sameLevels(DEFAULT_LEVEL),
  levelSource: null,
  levelsAt: 0,
  dailyGoalMinutes: 10,
};
