import type { SyncRecord, TableMap, TableName } from "../model";
import { mergeRecord } from "./merge";

/** Device metadata (IndexedDB `meta`): the account this device syncs with now; null after a sign-out. */
export const LINKED_KEY = "linkedUser";
/** The account whose data this device holds. Kept after a sign-out that keeps the data. */
export const OWNER_KEY = "dataOwner";
/** True once real progress was written while no account was linked (guest play). */
export const GUEST_PROGRESS_KEY = "guestProgress";
/**
 * Meta that survives "delete all my data" and an import that replaces: deleting
 * progress never unlinks the device from the signed-in account (DECISIONS A9).
 */
/** The pull position for one account. Its presence also shows this device has synced with that account. */
export const cursorKey = (userId: string): string => `cursor:${userId}`;

export const KEPT_META_KEYS: readonly string[] = [LINKED_KEY, OWNER_KEY];

/**
 * - sync: already linked to this account.
 * - relink: the data here is this account's own (signed out, kept data, signed back in).
 * - adopt-remote: nothing here to ask about; take the account's data (a guest's level and settings merge in).
 * - ask: real progress not yet linked to this account: merge, keep separate, or back up first.
 */
export type FirstSyncDecision = "sync" | "relink" | "ask" | "adopt-remote";

export interface FirstSyncInput {
  readonly userId: string;
  readonly linkedUserId: string | null;
  readonly ownerUserId: string | null;
  /** Real progress is stored (PROGRESS_TABLES, deleted rows aside). */
  readonly hasProgress: boolean;
  /** Any record is stored (a level, settings, the own dictionary…). */
  readonly hasAnyData: boolean;
  /** Progress was written while no account was linked. */
  readonly guestProgress: boolean;
}

/**
 * What to do when an account signs in on this device (DECISIONS A9).
 * Real guest progress is never mixed into an account (or replaced) without
 * asking; a level or settings alone never ask; once the device is linked, the
 * question never comes back for that account (reload, restart, later sign-ins).
 */
export function decideFirstSync(i: FirstSyncInput): FirstSyncDecision {
  if (i.linkedUserId === i.userId) return "sync";
  const owner = i.linkedUserId ?? i.ownerUserId;
  // Another account's data: never mixed into this one silently, whatever it is.
  if (owner !== null && owner !== i.userId) return i.hasAnyData ? "ask" : "adopt-remote";
  // This account's own data, unless someone played here as a guest since the sign-out.
  if (owner === i.userId) return i.hasProgress && i.guestProgress ? "ask" : "relink";
  return i.hasProgress ? "ask" : "adopt-remote";
}

/**
 * Pulls re-read a few seconds before the last cursor: rows committed slightly
 * out of order are not missed, and re-merging a row is harmless (idempotent).
 */
export const PULL_OVERLAP_MS = 5000;

/** Key-order-independent JSON (jsonb and zod both reorder keys). */
export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

const same = (a: SyncRecord, b: SyncRecord) => canonicalJson(a) === canonicalJson(b);

/**
 * Merges one pulled record with the local copy using the sync rules.
 * A local winner is sent back; if it is not newer than the remote copy (stage
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
  // The winner can be a blend (a stage keeps the earliest clear time), so compare with the local copy.
  return { toLocal: local && same(stamped, local) ? null : stamped, toRemote: stamped };
}
