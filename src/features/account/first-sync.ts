import { PROGRESS_TABLES, TABLE_NAMES, type TableName } from "@/domain/model";
import { cursorKey, GUEST_PROGRESS_KEY, LINKED_KEY, OWNER_KEY, type FirstSyncInput } from "@/domain/sync/session";
import type { OutboxStore } from "@/repositories/local/outbox";
import type { RecordStore } from "@/repositories/store";

/**
 * Device state for the sign-in decision (decideFirstSync, DECISIONS A9).
 * Reads local data only, so it is the same on every reload.
 */
export async function readFirstSyncInput(store: RecordStore, outbox: OutboxStore, userId: string): Promise<FirstSyncInput> {
  let hasAnyData = false;
  let hasProgress = false;
  for (const t of TABLE_NAMES) {
    const rows = await store.all(t);
    if (rows.length > 0) hasAnyData = true;
    if (PROGRESS_TABLES.includes(t) && rows.some((r) => r.deletedAt === undefined)) {
      hasProgress = true;
      break;
    }
  }
  const owner = (await outbox.getMeta<string | null>(OWNER_KEY)) ?? null;
  // Devices from before OWNER_KEY: a pull position for this account means its data was synced here.
  const syncedHere = typeof (await outbox.getMeta<unknown>(cursorKey(userId))) === "string";
  return {
    userId,
    linkedUserId: (await outbox.getMeta<string | null>(LINKED_KEY)) ?? null,
    ownerUserId: owner ?? (syncedHere ? userId : null),
    hasProgress,
    hasAnyData,
    guestProgress: (await outbox.getMeta<boolean>(GUEST_PROGRESS_KEY)) === true,
  };
}

/** The device now syncs with this account and holds its data; no guest progress is pending. */
export async function markLinked(outbox: OutboxStore, userId: string): Promise<void> {
  await outbox.setMeta(LINKED_KEY, userId);
  await outbox.setMeta(OWNER_KEY, userId);
  await outbox.setMeta(GUEST_PROGRESS_KEY, false);
}

/** Signed out. `keepData`: the data stays and still belongs to the account (signing back in does not ask). */
export async function markSignedOut(outbox: OutboxStore, keepData: boolean): Promise<void> {
  await outbox.setMeta(LINKED_KEY, null);
  if (!keepData) {
    await outbox.setMeta(OWNER_KEY, null);
    await outbox.setMeta(GUEST_PROGRESS_KEY, false);
  }
}

/** Real progress written while no account is linked: a later sign-in asks before mixing it in. */
export async function noteGuestWrite(outbox: OutboxStore, table: TableName): Promise<void> {
  if (!PROGRESS_TABLES.includes(table)) return;
  if (((await outbox.getMeta<string | null>(LINKED_KEY)) ?? null) !== null) return;
  await outbox.setMeta(GUEST_PROGRESS_KEY, true);
}
