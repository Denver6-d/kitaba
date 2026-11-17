import Dexie, { type EntityTable } from "dexie";
import { TABLE_NAMES, type TableMap, type TableName } from "@/domain/model";
import type { OutboxItem } from "@/domain/sync/outbox";
import type { RecordStore } from "../store";

export interface MetaRow {
  readonly key: string;
  readonly value: unknown;
}

type Tables = { [K in TableName]: EntityTable<TableMap[K], "id"> };

export type KitabaDb = Dexie &
  Tables & {
    outbox: EntityTable<OutboxItem, "key">;
    meta: EntityTable<MetaRow, "key">;
  };

export const DB_NAME = "kitaba";

/**
 * Versioned schema. Never edit a published version: add db.version(n + 1)
 * with the new stores and an upgrade() if records need reshaping.
 */
export function openDb(options?: ConstructorParameters<typeof Dexie>[1], name = DB_NAME): KitabaDb {
  const db = new Dexie(name, options) as KitabaDb;
  db.version(1).stores({
    results: "id, at, modeKey, updatedAt",
    keystats: "id, updatedAt",
    ghosts: "id, updatedAt",
    srs: "id, due, updatedAt",
    attempts: "id, sentenceId, at, updatedAt",
    mastery: "id, updatedAt",
    scenarios: "id, scenarioId, at, updatedAt",
    activity: "id, day, at, updatedAt",
    achievements: "id, updatedAt",
    profile: "id, updatedAt",
    outbox: "key",
    meta: "key",
  });
  return db;
}

export function createDexieStore(db: KitabaDb): RecordStore {
  const t = <T extends TableName>(name: T) => db.table<TableMap[T], string>(name);
  return {
    all: (name) => t(name).toArray(),
    get: (name, id) => t(name).get(id),
    async put(name, record) {
      await t(name).put(record);
    },
    async bulkPut(name, records) {
      await t(name).bulkPut([...records]);
    },
    async clear() {
      await db.transaction("rw", [...TABLE_NAMES, "outbox", "meta"], async () => {
        await Promise.all([...TABLE_NAMES, "outbox", "meta"].map((n) => db.table(n).clear()));
      });
    },
  };
}
