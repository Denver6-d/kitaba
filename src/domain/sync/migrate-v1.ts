import { LEVELS, TABLE_NAMES, type ActivityKind, type SyncRecord, type TableName } from "../model";
import { ACHIEVEMENT_IDS } from "../progress/achievements";
import { migrateProfileRow } from "./migrate-profile";

/**
 * Schema v1 → v2 (spelling pivot, DECISIONS V3). Pure, so the same rules run
 * in the Dexie upgrade and when a v1 export file is imported.
 *
 * Kept: SRS cards, spelling mastery, activity (streak + XP), achievements that
 * still exist, the daily goal. Dropped: typing results, key stats, ghosts,
 * sentence and scenario attempts, the diagnostic plan.
 */

export const V1_DROPPED_TABLES = ["results", "keystats", "ghosts", "attempts", "scenarios"] as const;

const KEPT_ACTIVITY: ReadonlySet<string> = new Set<ActivityKind>(["spelling", "game", "review", "legacy"]);
const VALID_LEVELS: ReadonlySet<string> = new Set(LEVELS);

type Row = Record<string, unknown>;

/** Returns the v2 shape of a v1 row, or null when the row is no longer needed. */
export function migrateV1Row(table: string, row: Row): Row | null {
  switch (table) {
    case "srs":
      return row;
    case "mastery":
      return typeof row.id === "string" && row.id.startsWith("spell:") ? row : null;
    case "activity":
      return KEPT_ACTIVITY.has(String(row.kind)) ? row : { ...row, kind: "legacy" };
    case "achievements":
      return typeof row.id === "string" && ACHIEVEMENT_IDS.has(row.id) ? row : null;
    case "profile": {
      // v1 → v2 drops the plan and the diagnostic date; v2 → v3 then splits the level in three.
      const level = typeof row.level === "string" && VALID_LEVELS.has(row.level) ? row.level : null;
      const goal = typeof row.dailyGoalMinutes === "number" ? row.dailyGoalMinutes : 10;
      const v2: Row = { id: row.id, updatedAt: row.updatedAt, level, dailyGoalMinutes: goal };
      if (row.levels !== undefined) v2.levels = row.levels;
      if (row.levelSource !== undefined) v2.levelSource = row.levelSource;
      if (row.levelsAt !== undefined) v2.levelsAt = row.levelsAt;
      if (row.deletedAt !== undefined) v2.deletedAt = row.deletedAt;
      return migrateProfileRow(v2);
    }
    default:
      return null;
  }
}

/** Migrates every table of a v1 snapshot; unknown and dropped tables disappear. */
export function migrateV1Tables(tables: Readonly<Record<string, readonly unknown[] | undefined>>): Record<TableName, SyncRecord[]> {
  const out = Object.fromEntries(TABLE_NAMES.map((t) => [t, [] as SyncRecord[]])) as Record<TableName, SyncRecord[]>;
  for (const [table, rows] of Object.entries(tables)) {
    if (!(TABLE_NAMES as readonly string[]).includes(table) || !rows) continue;
    for (const row of rows) {
      if (typeof row !== "object" || row === null) continue;
      const migrated = migrateV1Row(table, row as Row);
      if (migrated) out[table as TableName].push(migrated as unknown as SyncRecord);
    }
  }
  return out;
}
