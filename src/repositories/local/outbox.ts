import { enqueue, outboxKey, removeAcked, type OutboxItem } from "@/domain/sync/outbox";
import type { SyncRecord, TableName } from "@/domain/model";
import type { KitabaDb } from "./db";

/** Persistent queue of writes waiting for the cloud, plus small sync metadata. */
export interface OutboxStore {
  add(table: TableName, records: readonly SyncRecord[]): Promise<void>;
  list(limit: number): Promise<OutboxItem[]>;
  ack(items: readonly OutboxItem[]): Promise<void>;
  count(): Promise<number>;
  clear(): Promise<void>;
  getMeta<T>(key: string): Promise<T | undefined>;
  setMeta(key: string, value: unknown): Promise<void>;
}

export function createDexieOutbox(db: KitabaDb): OutboxStore {
  return {
    async add(table, records) {
      await db.transaction("rw", db.outbox, async () => {
        for (const record of records) {
          const key = outboxKey(table, record.id);
          const existing = await db.outbox.get(key);
          const [next] = enqueue(existing ? [existing] : [], { key, table, record });
          if (next && next !== existing) await db.outbox.put(next);
        }
      });
    },
    list: (limit) => db.outbox.limit(limit).toArray(),
    async ack(items) {
      await db.transaction("rw", db.outbox, async () => {
        const current = await db.outbox.bulkGet(items.map((i) => i.key));
        const present = current.filter((c): c is OutboxItem => c !== undefined);
        const keep = new Set(removeAcked(present, items).map((i) => i.key));
        await db.outbox.bulkDelete(present.filter((p) => !keep.has(p.key)).map((p) => p.key));
      });
    },
    count: () => db.outbox.count(),
    async clear() {
      await db.outbox.clear();
    },
    async getMeta<T>(key: string) {
      return (await db.meta.get(key))?.value as T | undefined;
    },
    async setMeta(key, value) {
      await db.meta.put({ key, value });
    },
  };
}

export function createMemoryOutbox(): OutboxStore {
  let queue: OutboxItem[] = [];
  const meta = new Map<string, unknown>();
  return {
    async add(table, records) {
      for (const record of records) queue = enqueue(queue, { key: outboxKey(table, record.id), table, record });
    },
    list: async (limit) => queue.slice(0, limit),
    async ack(items) {
      queue = removeAcked(queue, items);
    },
    count: async () => queue.length,
    async clear() {
      queue = [];
    },
    getMeta: async <T,>(key: string) => meta.get(key) as T | undefined,
    async setMeta(key, value) {
      meta.set(key, value);
    },
  };
}
