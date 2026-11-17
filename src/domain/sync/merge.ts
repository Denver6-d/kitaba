import type { AchievementRecord, GhostRecord, SyncRecord, TableMap, TableName } from "../model";

/**
 * Merge rules for sync (documented in DECISIONS.md, D7):
 * - Default: last-write-wins per record by `updatedAt`; an exact tie goes to the remote copy.
 *   Tombstones (`deletedAt`) are ordinary writes and follow the same rule.
 * - Append-only tables (results, keystats, attempts, scenarios, activity) have unique ids, so the
 *   rule degenerates to a union and nothing is lost.
 * - ghosts: the faster run wins (it is a personal best, not an edit).
 * - achievements: the earliest unlock wins.
 */
export function mergeRecord<T extends TableName>(
  table: T,
  local: TableMap[T] | undefined,
  remote: TableMap[T] | undefined,
): TableMap[T] | undefined {
  if (!local) return remote;
  if (!remote) return local;
  if (table === "ghosts") {
    const l = local as unknown as GhostRecord;
    const r = remote as unknown as GhostRecord;
    if (l.wpm !== r.wpm) return (l.wpm > r.wpm ? local : remote);
  }
  if (table === "achievements") {
    const l = local as unknown as AchievementRecord;
    const r = remote as unknown as AchievementRecord;
    if (l.unlockedAt !== r.unlockedAt) return l.unlockedAt < r.unlockedAt ? local : remote;
  }
  return lww(local, remote);
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
