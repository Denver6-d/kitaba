import type { ErrorType } from "./sentences/grader";
import type { KeyStats } from "./typing/key-stats";
import type { GhostPoint } from "./typing/ghost";
import type { TestSource } from "./typing/personal-best";
import type { CefrLevel, PlanStep } from "./progress/diagnostic";

/**
 * Persisted records. Every synced record carries an id, an updatedAt
 * timestamp (ms) and an optional deletedAt tombstone; the sync merge rules in
 * domain/sync/merge.ts rely on these.
 */
export interface SyncRecord {
  readonly id: string;
  readonly updatedAt: number;
  readonly deletedAt?: number;
}

export interface TestResultRecord extends SyncRecord {
  readonly modeKey: string;
  readonly source: TestSource;
  readonly duration: number;
  readonly wpm: number;
  readonly rawWpm: number;
  readonly accuracy: number;
  readonly consistency: number;
  readonly chars: number;
  readonly errors: number;
  readonly layoutMismatches: number;
  readonly samples: readonly number[];
  readonly at: number;
}

/** Key statistics are stored as one delta per session (append-only, so merging never double counts). */
export interface KeyStatsDelta extends SyncRecord {
  readonly stats: KeyStats;
  readonly at: number;
}

/** The best run for a mode, replayed as the ghost. id = modeKey. */
export interface GhostRecord extends SyncRecord {
  readonly modeKey: string;
  readonly wpm: number;
  readonly target: string;
  readonly ghost: readonly GhostPoint[];
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
}

export interface SentenceAttemptRecord extends SyncRecord {
  readonly sentenceId: string;
  readonly input: string;
  readonly score: number;
  readonly errors: readonly ErrorType[];
  readonly at: number;
}

/** How well an item (sentence, lesson, scenario) is known; drives Arabic hint fading. id = item key. */
export interface MasteryRecord extends SyncRecord {
  readonly mastery: number;
}

export interface ScenarioAttemptRecord extends SyncRecord {
  readonly scenarioId: string;
  readonly text: string;
  readonly passed: number;
  readonly total: number;
  readonly at: number;
}

export type ActivityKind = "typing" | "lesson" | "spelling" | "sentence" | "scenario" | "diagnostic";

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

/** id = "me". */
export interface ProfileRecord extends SyncRecord {
  readonly level: CefrLevel | null;
  readonly plan: readonly PlanStep[];
  readonly dailyGoalMinutes: number;
  readonly diagnosticAt: number | null;
}

export interface TableMap {
  readonly results: TestResultRecord;
  readonly keystats: KeyStatsDelta;
  readonly ghosts: GhostRecord;
  readonly srs: SrsCardRecord;
  readonly attempts: SentenceAttemptRecord;
  readonly mastery: MasteryRecord;
  readonly scenarios: ScenarioAttemptRecord;
  readonly activity: ActivityRecord;
  readonly achievements: AchievementRecord;
  readonly profile: ProfileRecord;
}

export type TableName = keyof TableMap;

export const TABLE_NAMES: readonly TableName[] = [
  "results",
  "keystats",
  "ghosts",
  "srs",
  "attempts",
  "mastery",
  "scenarios",
  "activity",
  "achievements",
  "profile",
];

export const DEFAULT_PROFILE: ProfileRecord = {
  id: "me",
  updatedAt: 0,
  level: null,
  plan: [],
  dailyGoalMinutes: 10,
  diagnosticAt: null,
};
