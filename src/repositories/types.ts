import type {
  AchievementRecord,
  ActivityKind,
  ActivityRecord,
  ProfileRecord,
  SessionRecord,
  SrsCardRecord,
  StageRecord,
  WritingRecord,
} from "@/domain/model";
import type { ExportFile } from "./export";

/**
 * Repository interfaces: the only persistence API the UI and features see.
 * They do not know whether data lives in IndexedDB, in memory or in Supabase.
 */

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

/** Per-item mastery (Arabic hint fading). Keys look like "spell:<wordId>". */
export interface MasteryRepository {
  get(itemKey: string): Promise<number>;
  all(): Promise<Record<string, number>>;
  set(itemKey: string, mastery: number): Promise<void>;
}

export type NewSession = Omit<SessionRecord, "id" | "updatedAt" | "deletedAt">;

export interface SaveSessionOutcome {
  readonly record: SessionRecord;
  /** The stage's best before this session (null for free play or a first attempt). */
  readonly previous: StageRecord | null;
  /** The stage's best after this session (null for free play). */
  readonly best: StageRecord | null;
}

export interface GameRepository {
  /** Saves a finished game; for a stage it also keeps the best result (stars, then points). */
  saveSession(session: NewSession, stars: number): Promise<SaveSessionOutcome>;
  sessions(): Promise<SessionRecord[]>;
  stages(): Promise<Record<string, StageRecord>>;
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

export type NewWriting = Omit<WritingRecord, "id" | "updatedAt" | "deletedAt">;

/** Free-writing and dictation history (append-only). */
export interface WritingRepository {
  /** Saves a finished text; the text and the mistakes list are capped. */
  save(w: NewWriting): Promise<WritingRecord>;
  /** Newest first. */
  list(): Promise<WritingRecord[]>;
}

/** The learner's own words, never flagged by the spelling checker. Synced. */
export interface DictionaryRepository {
  /** Lower-cased words. */
  words(): Promise<string[]>;
  add(word: string): Promise<void>;
  remove(word: string): Promise<void>;
}

export interface DataRepository {
  exportAll(): Promise<ExportFile>;
  /** "merge" applies the sync merge rules; "replace" clears local data first. */
  importAll(file: ExportFile, mode: "merge" | "replace"): Promise<void>;
  clearAll(): Promise<void>;
}

export interface Repositories {
  readonly activity: ActivityRepository;
  readonly words: WordRepository;
  readonly mastery: MasteryRepository;
  readonly games: GameRepository;
  readonly achievements: AchievementRepository;
  readonly profile: ProfileRepository;
  readonly writing: WritingRepository;
  readonly dictionary: DictionaryRepository;
  readonly data: DataRepository;
}

/** Public weekly leaderboard row: nickname and score only (the SQL view exposes nothing else). */
export interface PublicScore {
  readonly rank: number;
  readonly nickname: string;
  /** Points this week (sum of submitted games). */
  readonly points: number;
  /** Words spelled correctly this week. */
  readonly words: number;
  readonly lastAt: string;
}

export type SubmitStatus = "ok" | "not_opted_in" | "too_short" | "low_accuracy" | "implausible" | "rate_limited" | "error";
export type NicknameStatus = "ok" | "length" | "chars" | "blocked" | "taken" | "error";

export interface ScoreSubmission {
  readonly points: number;
  readonly correct: number;
  readonly total: number;
  readonly durationS: number;
}

/** Opt-in public leaderboard (cloud only; exists only when accounts are configured). */
export interface LeaderboardRepository {
  weekly(): Promise<PublicScore[]>;
  /** The caller's nickname, or null when not on the board. */
  myNickname(): Promise<string | null>;
  /** Join the board, or change the nickname. */
  setNickname(nickname: string): Promise<NicknameStatus>;
  /** Leave the board: removes the nickname and every score. */
  leave(): Promise<void>;
  submit(score: ScoreSubmission): Promise<SubmitStatus>;
}
