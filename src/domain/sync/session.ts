import type { SyncRecord, TableMap, TableName } from "../model";
import { mergeRecord } from "./merge";

export type FirstSyncDecision = "sync" | "ask" | "adopt-remote";

/**
 * What to do when an account signs in on this device.
 * Local progress is never mixed into an account (or replaced) without asking.
 */
export function decideFirstSync(i: { linkedUserId: string | null; userId: string; localHasData: boolean }): FirstSyncDecision {
  if (i.linkedUserId === i.userId) return "sync";
  if (!i.localHasData) return "adopt-remote";
  return "ask";
}

/**
 * Pulls re-read a few seconds before the last cursor: rows committed slightly
 * out of order are not missed, and re-merging a row is harmless (idempotent).
 */
export const PULL_OVERLAP_MS = 5000;

const same = (a: SyncRecord, b: SyncRecord) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Merges one pulled record with the local copy using the sync rules.
 * A local winner is sent back; if it is not newer than the remote copy (ghost
 * and achievement rules can prefer an older record), its timestamp is bumped
 * so the server's last-write-wins guard accepts it.
 */
export function reconcilePulled<T extends TableName>(
  table: T,
  local: TableMap[T] | undefined,
  remote: TableMap[T],
): { toLocal: TableMap[T] | null; toRemote: TableMap[T] | null } {
  const winner = mergeRecord(table, local, remote);
  if (!winner || same(winner, remote)) {
    return { toLocal: local && same(local, remote) ? null : remote, toRemote: null };
  }
  const stamped = winner.updatedAt > remote.updatedAt ? winner : ({ ...winner, updatedAt: remote.updatedAt + 1 } as TableMap[T]);
  return { toLocal: stamped === winner ? null : stamped, toRemote: stamped };
}
