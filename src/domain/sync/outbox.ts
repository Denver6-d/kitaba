import type { SyncRecord, TableName } from "../model";

/** A pending write waiting to be pushed to the cloud. key = `${table}:${id}`. */
export interface OutboxItem {
  readonly key: string;
  readonly table: TableName;
  readonly record: SyncRecord;
}

export const outboxKey = (table: TableName, id: string): string => `${table}:${id}`;

/** Add a write, keeping only the newest version per record. */
export function enqueue(queue: readonly OutboxItem[], item: OutboxItem): OutboxItem[] {
  const i = queue.findIndex((q) => q.key === item.key);
  if (i === -1) return [...queue, item];
  const existing = queue[i];
  if (existing && existing.record.updatedAt > item.record.updatedAt) return [...queue];
  const next = [...queue];
  next[i] = item;
  return next;
}

/** Drop items the server acknowledged, unless they were rewritten locally since. */
export function removeAcked(queue: readonly OutboxItem[], acked: readonly OutboxItem[]): OutboxItem[] {
  const ackedVersion = new Map(acked.map((a) => [a.key, a.record.updatedAt]));
  return queue.filter((q) => {
    const v = ackedVersion.get(q.key);
    return v === undefined || q.record.updatedAt > v;
  });
}

/** Exponential backoff: 1 s, 2 s, 4 s … capped at 60 s. */
export function nextRetryDelay(attempt: number): number {
  return Math.min(60_000, 1000 * 2 ** Math.max(0, attempt));
}
