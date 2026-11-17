import { z } from "zod";
import { GAME_MODES, LEVELS, type SyncRecord, type TableName } from "@/domain/model";
import { migrateV1Tables } from "@/domain/sync/migrate-v1";

/**
 * Versioned JSON export of all progress. On import every record is validated
 * against a strict per-table schema, so a corrupt or hand-edited file cannot
 * plant rows that break the app later. Version 1 files (before the spelling
 * pivot) are migrated with the same rules as the local database (DECISIONS V3).
 */
export const EXPORT_VERSION = 2;

const num = z.number().finite();
const nonNeg = num.nonnegative();
const int = z.number().int().nonnegative();
const shortId = z.string().min(1).max(200);
const base = { id: shortId, updatedAt: nonNeg, deletedAt: nonNeg.optional() };

export const recordSchemas = {
  srs: z
    .object({ ...base, wordId: shortId, ease: num.min(1).max(5), interval: int, reps: int, lapses: int, due: nonNeg, lastReviewed: nonNeg })
    .strict(),
  mastery: z.object({ ...base, mastery: int.max(1000) }).strict(),
  activity: z
    .object({
      ...base,
      kind: z.enum(["spelling", "game", "review", "legacy"]),
      at: nonNeg,
      day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      seconds: int.max(86_400),
      xp: int.max(10_000),
    })
    .strict(),
  achievements: z.object({ ...base, unlockedAt: nonNeg }).strict(),
  profile: z.object({ ...base, level: z.enum(LEVELS).nullable(), dailyGoalMinutes: int.max(240) }).strict(),
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

const v1FileSchema = z.object({
  app: z.literal("kitaba"),
  version: z.literal(1),
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
  const v1 = v1FileSchema.safeParse(raw);
  if (v1.success) {
    raw = { app: "kitaba", version: EXPORT_VERSION, exportedAt: v1.data.exportedAt, tables: migrateV1Tables(v1.data.tables) };
  }
  const parsed = exportFileSchema.safeParse(raw);
  if (!parsed.success) throw new Error("invalid-format");
  return parsed.data as unknown as ExportFile;
}
