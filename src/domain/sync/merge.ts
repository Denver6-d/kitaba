import type { AchievementRecord, ProfileRecord, StageRecord, SyncRecord, TableMap, TableName } from "../model";

/**
 * Merge rules for sync (DECISIONS A4, V3):
 * - Default: last-write-wins per record by `updatedAt`; an exact tie goes to the remote copy.
 *   Tombstones (`deletedAt`) are ordinary writes and follow the same rule.
 * - Append-only tables (activity, sessions) have unique ids, so the rule degenerates to a
 *   union and nothing is lost.
 * - stages: the better result wins (more stars, then more points); it is a best, not an edit.
 *   The earliest clear time is kept either way.
 * - achievements: the earliest unlock wins.
 */
export function mergeRecord<T extends TableName>(
  table: T,
  local: TableMap[T] | undefined,
  remote: TableMap[T] | undefined,
): TableMap[T] | undefined {
  if (!local) return remote;
  if (!remote) return local;
  if (table === "stages") {
    const l = local as unknown as StageRecord;
    const r = remote as unknown as StageRecord;
    const better = compareStage(l, r);
    if (better !== 0) {
      const winner = better > 0 ? l : r;
      const clearedAt = earliestClear(l, r);
      return (clearedAt === winner.clearedAt ? winner : { ...winner, clearedAt }) as unknown as TableMap[T];
    }
  }
  if (table === "achievements") {
    const l = local as unknown as AchievementRecord;
    const r = remote as unknown as AchievementRecord;
    if (l.unlockedAt !== r.unlockedAt) return l.unlockedAt < r.unlockedAt ? local : remote;
  }
  if (table === "profile") {
    const winner = lww(local, remote) as unknown as ProfileRecord;
    const loser = (winner === (local as unknown) ? remote : local) as unknown as ProfileRecord;
    // The newer row wins, but chosen levels are never replaced by "not chosen yet" (a device that has
    // not set them, or an older client without levels); between two choices the later one wins.
    const keepLevels = (winner.levelSource === null && loser.levelSource !== null) || (loser.levelSource !== null && loser.levelsAt > winner.levelsAt);
    if (keepLevels) return { ...winner, levels: loser.levels, levelSource: loser.levelSource, levelsAt: loser.levelsAt } as unknown as TableMap[T];
    return winner as unknown as TableMap[T];
  }
  return lww(local, remote);
}

/** > 0 when a is the better stage result, < 0 when b is, 0 when equal. */
export function compareStage(a: StageRecord, b: StageRecord): number {
  if (a.stars !== b.stars) return a.stars - b.stars;
  return a.bestPoints - b.bestPoints;
}

function earliestClear(a: StageRecord, b: StageRecord): number {
  const times = [a.clearedAt, b.clearedAt].filter((t) => t > 0);
  return times.length === 0 ? 0 : Math.min(...times);
}

function lww<R extends SyncRecord>(local: R, remote: R): R {
  return local.updatedAt > remote.updatedAt ? local : remote;
}

export interface TableMergeResult<R> {
  /** Records the local store must write. */
  readonly toLocal: R[];
  /** Records the remote store must write. */
  readonly toRemote: R[];
  /** The merged view of the table. */
  readonly merged: R[];
}

export function mergeTable<T extends TableName>(
  table: T,
  local: readonly TableMap[T][],
  remote: readonly TableMap[T][],
): TableMergeResult<TableMap[T]> {
  const localById = new Map(local.map((r) => [r.id, r]));
  const remoteById = new Map(remote.map((r) => [r.id, r]));
  const ids = new Set([...localById.keys(), ...remoteById.keys()]);
  const toLocal: TableMap[T][] = [];
  const toRemote: TableMap[T][] = [];
  const merged: TableMap[T][] = [];
  for (const id of [...ids].sort()) {
    const l = localById.get(id);
    const r = remoteById.get(id);
    const winner = mergeRecord(table, l, r);
    if (!winner) continue;
    merged.push(winner);
    if (winner !== l && !sameVersion(winner, l)) toLocal.push(winner);
    if (winner !== r && !sameVersion(winner, r)) toRemote.push(winner);
  }
  return { toLocal, toRemote, merged };
}

function sameVersion(a: SyncRecord, b: SyncRecord | undefined): boolean {
  return b !== undefined && JSON.stringify(a) === JSON.stringify(b);
}
