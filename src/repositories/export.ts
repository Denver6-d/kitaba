import { z } from "zod";
import { TABLE_NAMES, type SyncRecord, type TableName } from "@/domain/model";

/** Versioned JSON export of all progress. Validated with zod on import. */
export const EXPORT_VERSION = 1;

const recordSchema = z
  .object({
    id: z.string().min(1).max(200),
    updatedAt: z.number().finite().nonnegative(),
    deletedAt: z.number().finite().nonnegative().optional(),
  })
  .loose();

const tablesShape = Object.fromEntries(
  TABLE_NAMES.map((t) => [t, z.array(recordSchema).max(50_000).default([])]),
) as Record<TableName, z.ZodDefault<z.ZodArray<typeof recordSchema>>>;

export const exportFileSchema = z.object({
  app: z.literal("kitaba"),
  version: z.literal(EXPORT_VERSION),
  exportedAt: z.number(),
  tables: z.object(tablesShape),
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
