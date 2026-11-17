import { z } from "zod";
import type { SyncRecord, TableName } from "@/domain/model";
import { ERROR_TYPES } from "@/domain/sentences/grader";

/**
 * Versioned JSON export of all progress. On import every record is validated
 * against a strict per-table schema, so a corrupt or hand-edited file cannot
 * plant rows that break the app later.
 */
export const EXPORT_VERSION = 1;

const num = z.number().finite();
const nonNeg = num.nonnegative();
const int = z.number().int().nonnegative();
const shortId = z.string().min(1).max(200);
const base = { id: shortId, updatedAt: nonNeg, deletedAt: nonNeg.optional() };

/** Key stats keyed by a single character. Rejects "__proto__" and friends by construction. */
const keyStats = z
  .record(z.string().regex(/^[\x20-\x7E]$/), z.object({ hits: int, misses: int }).strict())
  .refine((r) => Object.keys(r).length <= 128);

const cefr = z.enum(["A1", "A2", "B1"]);
const planStep = z.enum(["foundation", "typing", "spelling", "sentences", "professional"]);
const source = z.enum(["words", "sentences", "custom", "adaptive", "lesson", "diagnostic"]);

export const recordSchemas = {
  results: z
    .object({
      ...base,
      modeKey: z.string().max(40),
      source,
      duration: int.max(3600),
      wpm: nonNeg.max(400),
      rawWpm: nonNeg.max(500),
      accuracy: nonNeg.max(100),
      consistency: nonNeg.max(100),
      chars: int,
      errors: int,
      layoutMismatches: int,
      samples: z.array(nonNeg).max(3600),
      at: nonNeg,
    })
    .strict(),
  keystats: z.object({ ...base, stats: keyStats, at: nonNeg }).strict(),
  ghosts: z
    .object({
      ...base,
      modeKey: z.string().max(40),
      wpm: nonNeg.max(400),
      target: z.string().max(20_000),
      ghost: z.array(z.tuple([nonNeg, int])).max(2000),
    })
    .strict(),
  srs: z
    .object({ ...base, wordId: shortId, ease: num.min(1).max(5), interval: int, reps: int, lapses: int, due: nonNeg, lastReviewed: nonNeg })
    .strict(),
  attempts: z
    .object({ ...base, sentenceId: shortId, input: z.string().max(2000), score: nonNeg.max(1), errors: z.array(z.enum(ERROR_TYPES as [string, ...string[]])).max(100), at: nonNeg })
    .strict(),
  mastery: z.object({ ...base, mastery: int.max(1000) }).strict(),
  scenarios: z.object({ ...base, scenarioId: shortId, text: z.string().max(10_000), passed: int, total: int, at: nonNeg }).strict(),
  activity: z
    .object({
      ...base,
      kind: z.enum(["typing", "lesson", "spelling", "sentence", "scenario", "diagnostic"]),
      at: nonNeg,
      day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      seconds: int.max(86_400),
      xp: int.max(10_000),
    })
    .strict(),
  achievements: z.object({ ...base, unlockedAt: nonNeg }).strict(),
  profile: z
    .object({ ...base, level: cefr.nullable(), plan: z.array(planStep).max(10), dailyGoalMinutes: int.max(240), diagnosticAt: nonNeg.nullable() })
    .strict(),
} satisfies Record<TableName, z.ZodType>;

const MAX_ROWS = 50_000;

export const exportFileSchema = z.object({
  app: z.literal("kitaba"),
  version: z.literal(EXPORT_VERSION),
  exportedAt: z.number(),
  tables: z
    .object(
      Object.fromEntries(Object.entries(recordSchemas).map(([t, s]) => [t, z.array(s).max(MAX_ROWS).default([])])) as {
        [K in TableName]: z.ZodDefault<z.ZodArray<(typeof recordSchemas)[K]>>;
      },
    )
    .strict(),
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
  const parsed = exportFileSchema.safeParse(raw);
  if (!parsed.success) throw new Error("invalid-format");
  return parsed.data as unknown as ExportFile;
}
