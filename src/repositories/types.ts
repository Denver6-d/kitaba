import type {
  AchievementRecord,
  ActivityKind,
  ActivityRecord,
  GhostRecord,
  ProfileRecord,
  ScenarioAttemptRecord,
  SentenceAttemptRecord,
  SrsCardRecord,
  TestResultRecord,
} from "@/domain/model";
import type { KeyStats } from "@/domain/typing/key-stats";
import type { GhostPoint } from "@/domain/typing/ghost";
import type { PersonalBests } from "@/domain/typing/personal-best";
import type { ExportFile } from "./export";

/**
 * Repository interfaces: the only persistence API the UI and features see.
 * They do not know whether data lives in IndexedDB, in memory or in Supabase.
 */

export type NewTestResult = Omit<TestResultRecord, "id" | "updatedAt" | "deletedAt">;

export interface SaveTestOutcome {
  readonly record: TestResultRecord;
  readonly isNewBest: boolean;
  readonly previousBest: number | null;
}

export interface ProgressRepository {
  saveTestResult(
    result: NewTestResult,
    extras: { readonly keyStats: KeyStats; readonly target: string; readonly ghost: readonly GhostPoint[] },
  ): Promise<SaveTestOutcome>;
  listResults(): Promise<TestResultRecord[]>;
  personalBests(): Promise<PersonalBests>;
  keyStats(): Promise<KeyStats>;
  addKeyStats(stats: KeyStats): Promise<void>;
  ghost(modeKey: string): Promise<GhostRecord | undefined>;
}

export interface ActivityRepository {
  log(kind: ActivityKind, seconds: number, xp: number): Promise<void>;
  list(): Promise<ActivityRecord[]>;
}

export interface WordRepository {
  card(wordId: string): Promise<SrsCardRecord | undefined>;
  saveCard(card: Omit<SrsCardRecord, "id" | "updatedAt">): Promise<void>;
  allCards(): Promise<SrsCardRecord[]>;
  dueCards(now: number): Promise<SrsCardRecord[]>;
}

export interface SentenceRepository {
  saveAttempt(attempt: Omit<SentenceAttemptRecord, "id" | "updatedAt">): Promise<void>;
  attempts(): Promise<SentenceAttemptRecord[]>;
  mastery(itemKey: string): Promise<number>;
  allMastery(): Promise<Record<string, number>>;
  setMastery(itemKey: string, mastery: number): Promise<void>;
}

export interface ScenarioRepository {
  saveAttempt(attempt: Omit<ScenarioAttemptRecord, "id" | "updatedAt">): Promise<void>;
  attempts(): Promise<ScenarioAttemptRecord[]>;
}

export interface AchievementRepository {
  list(): Promise<AchievementRecord[]>;
  /** Unlocks the given ids (already-unlocked ids are left untouched). Returns the newly unlocked ids. */
  unlock(ids: readonly string[]): Promise<string[]>;
}

export interface ProfileRepository {
  get(): Promise<ProfileRecord>;
  save(patch: Partial<Omit<ProfileRecord, "id" | "updatedAt">>): Promise<ProfileRecord>;
}

export interface DataRepository {
  exportAll(): Promise<ExportFile>;
  /** "merge" applies the sync merge rules; "replace" clears local data first. */
  importAll(file: ExportFile, mode: "merge" | "replace"): Promise<void>;
  clearAll(): Promise<void>;
}

export interface Repositories {
  readonly progress: ProgressRepository;
  readonly activity: ActivityRepository;
  readonly words: WordRepository;
  readonly sentences: SentenceRepository;
  readonly scenarios: ScenarioRepository;
  readonly achievements: AchievementRepository;
  readonly profile: ProfileRepository;
  readonly data: DataRepository;
}

/** Public leaderboard row: nickname, score and date only (the SQL views expose nothing else). */
export interface PublicScore {
  readonly rank: number;
  readonly nickname: string;
  readonly wpm: number;
  readonly accuracy: number;
  readonly achievedAt: string;
}

export type SubmitStatus = "ok" | "not_opted_in" | "too_short" | "low_accuracy" | "implausible" | "rate_limited" | "error";
export type NicknameStatus = "ok" | "length" | "chars" | "blocked" | "taken" | "error";

export interface ScoreSubmission {
  readonly wpm: number;
  readonly accuracy: number;
  readonly durationS: number;
  /** Correct characters typed. */
  readonly chars: number;
}

/** Opt-in public leaderboard (cloud only; exists only when accounts are configured). */
export interface LeaderboardRepository {
  top(board: "weekly" | "all"): Promise<PublicScore[]>;
  /** The caller's nickname, or null when not on the board. */
  myNickname(): Promise<string | null>;
  /** Join the board, or change the nickname. */
  setNickname(nickname: string): Promise<NicknameStatus>;
  /** Leave the board: removes the nickname and every score. */
  leave(): Promise<void>;
  submit(score: ScoreSubmission): Promise<SubmitStatus>;
}
