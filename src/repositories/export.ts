import { z } from "zod";
import { GAME_MODES, LEVEL_SOURCES, LEVELS, WRITING_MISSED_MAX, WRITING_TEXT_MAX, type SyncRecord, type TableName } from "@/domain/model";
import { migrateProfileRow } from "@/domain/sync/migrate-profile";
import { migrateV1Tables } from "@/domain/sync/migrate-v1";

/**
 * Versioned JSON export of all progress. On import every record is validated
 * against a strict per-table schema, so a corrupt or hand-edited file cannot
 * plant rows that break the app later. Version 1 files (before the spelling
 * pivot) are migrated with the same rules as the local database (DECISIONS V3).
 */
export const EXPORT_VERSION = 3;

const num = z.number().finite();
const nonNeg = num.nonnegative();
const int = z.number().int().nonnegative();
const shortId = z.string().min(1).max(200);
const base = { id: shortId, updatedAt: nonNeg, deletedAt: nonNeg.optional() };

export const recordSchemas = {
  srs: z
    .object({
      ...base,
      wordId: shortId,
      ease: num.min(1).max(5),
      interval: int,
      reps: int,
      lapses: int,
      due: nonNeg,
      lastReviewed: nonNeg,
      word: z.string().min(1).max(60).optional(),
      context: z.string().max(400).optional(),
    })
    .strict(),
  mastery: z.object({ ...base, mastery: int.max(1000) }).strict(),
  activity: z
    .object({
      ...base,
      kind: z.enum(["spelling", "game", "review", "writing", "legacy"]),
      at: nonNeg,
      day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      seconds: int.max(86_400),
      xp: int.max(10_000),
    })
    .strict(),
  achievements: z.object({ ...base, unlockedAt: nonNeg }).strict(),
  profile: z
    .object({
      ...base,
      levels: z.object({ words: z.enum(LEVELS), sentences: z.enum(LEVELS), tests: z.enum(LEVELS) }).strict(),
      levelSource: z.enum(LEVEL_SOURCES).nullable(),
      levelsAt: nonNeg,
      dailyGoalMinutes: int.max(240),
    })
    .strict(),
  sessions: z
    .object({
      ...base,
      mode: z.enum(GAME_MODES),
      stageId: z.string().max(40).nullable(),
      items: int.max(500),
      correct: int.max(500),
      points: int.max(100_000),
      maxCombo: int.max(500),
      seconds: int.max(86_400),
      at: nonNeg,
      missed: z.array(shortId).max(100),
    })
    .strict(),
  stages: z.object({ ...base, stars: int.max(3), bestPoints: int.max(100_000), clearedAt: nonNeg }).strict(),
  writings: z
    .object({
      ...base,
      mode: z.enum(["free", "dictation"]),
      sourceId: shortId,
      level: z.enum(LEVELS),
      text: z.string().max(WRITING_TEXT_MAX),
      words: int.max(5000),
      mistakes: int.max(5000),
      accuracy: num.min(0).max(1),
      stars: int.max(3),
      at: nonNeg,
      missed: z
        .array(z.object({ wrong: z.string().max(60), right: z.string().max(60).nullable(), type: z.string().max(20) }).strict())
        .max(WRITING_MISSED_MAX),
    })
    .strict(),
  dictionary: z.object({ ...base, word: z.string().min(1).max(60) }).strict(),
} satisfies Record<TableName, z.ZodType>;

const MAX_ROWS = 50_000;

const tablesSchema = z
  .object(
    Object.fromEntries(Object.entries(recordSchemas).map(([t, s]) => [t, z.array(s).max(MAX_ROWS).default([])])) as {
      [K in TableName]: z.ZodDefault<z.ZodArray<(typeof recordSchemas)[K]>>;
    },
  )
  .strict();

export const exportFileSchema = z.object({
  app: z.literal("kitaba"),
  version: z.literal(EXPORT_VERSION),
  exportedAt: z.number(),
  tables: tablesSchema,
});

const oldFileSchema = z.object({
  app: z.literal("kitaba"),
  version: z.union([z.literal(1), z.literal(2)]),
  exportedAt: z.number(),
  tables: z.record(z.string(), z.array(z.unknown()).max(MAX_ROWS)),
});

export interface ExportFile {
  readonly app: "kitaba";
  readonly version: typeof EXPORT_VERSION;
  readonly exportedAt: number;
  readonly tables: Readonly<Record<TableName, readonly SyncRecord[]>>;
}

/** Max import size (characters) to keep a pasted or malicious file from freezing the tab. */
export const MAX_IMPORT_CHARS = 20_000_000;

export function parseExportFile(json: string): ExportFile {
  if (json.length > MAX_IMPORT_CHARS) throw new Error("file-too-large");
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("invalid-json");
  }
  const old = oldFileSchema.safeParse(raw);
  if (old.success && old.data.version === 1) {
    raw = { app: "kitaba", version: EXPORT_VERSION, exportedAt: old.data.exportedAt, tables: migrateV1Tables(old.data.tables) };
  } else if (old.success) {
    // v2 → v3 only reshapes the profile (three levels).
    const profile = (old.data.tables.profile ?? []).map((r) => (r && typeof r === "object" ? migrateProfileRow(r as Record<string, unknown>) : r));
    raw = { ...old.data, version: EXPORT_VERSION, tables: { ...old.data.tables, profile } };
  }
  const parsed = exportFileSchema.safeParse(raw);
  if (!parsed.success) throw new Error("invalid-format");
  return parsed.data as unknown as ExportFile;
}
