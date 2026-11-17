import { DEFAULT_LEVEL, LEVEL_AREAS, LEVEL_SOURCES, LEVELS, type CefrLevel } from "../model";

/**
 * Profile v2 → v3 (DECISIONS E3). v2 had one optional `level`; v3 has three
 * levels (words, sentences, tests) and records how they were set. Pure and
 * idempotent, so the same rules run in the Dexie upgrade, on export-file
 * import and on cloud rows written by an older client.
 *
 * A v2 level was only ever set by the V1 diagnostic. It becomes all three
 * levels, marked as a choice so the learner is not asked again. Without one,
 * the levels default to A2 and the source stays null (the welcome screen shows).
 */

type Row = Record<string, unknown>;

const isLevel = (v: unknown): v is CefrLevel => typeof v === "string" && (LEVELS as readonly string[]).includes(v);

export function migrateProfileRow(row: Row): Row {
  const raw = row.levels && typeof row.levels === "object" && !Array.isArray(row.levels) ? (row.levels as Row) : null;
  // Levels count as set only when at least one valid level is stored.
  const old = raw && LEVEL_AREAS.some((a) => isLevel(raw[a])) ? raw : null;
  const fallback: CefrLevel = isLevel(row.level) ? row.level : DEFAULT_LEVEL;
  const levels = Object.fromEntries(LEVEL_AREAS.map((a) => [a, isLevel(old?.[a]) ? old[a] : fallback]));
  const source =
    typeof row.levelSource === "string" && (LEVEL_SOURCES as readonly string[]).includes(row.levelSource)
      ? row.levelSource
      : isLevel(row.level) || old
        ? "choice"
        : null;
  const out: Row = {
    id: row.id,
    updatedAt: row.updatedAt,
    levels,
    levelSource: source,
    levelsAt: typeof row.levelsAt === "number" && Number.isFinite(row.levelsAt) && row.levelsAt >= 0 ? row.levelsAt : 0,
    dailyGoalMinutes:
      typeof row.dailyGoalMinutes === "number" && Number.isInteger(row.dailyGoalMinutes) && row.dailyGoalMinutes >= 0 && row.dailyGoalMinutes <= 240
        ? row.dailyGoalMinutes
        : 10,
  };
  if (row.deletedAt !== undefined) out.deletedAt = row.deletedAt;
  return out;
}
