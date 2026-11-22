import Dexie, { type EntityTable } from "dexie";
import { TABLE_NAMES, type TableMap, type TableName } from "@/domain/model";
import type { OutboxItem } from "@/domain/sync/outbox";
import { migrateV1Row, V1_DROPPED_TABLES } from "@/domain/sync/migrate-v1";
import { migrateProfileRow } from "@/domain/sync/migrate-profile";
import { KEPT_META_KEYS } from "@/domain/sync/session";
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

/** Kept as "kitaba" so existing learners' data is found after the pivot (the product name lives in config/brand.ts). */
export const DB_NAME = "kitaba";

const MIGRATED_TABLES = ["srs", "mastery", "activity", "achievements", "profile"] as const;

/**
 * Versioned schema. Never edit a published version: add db.version(n + 1)
 * with the new stores and an upgrade() if records need reshaping.
 */
export function openDb(options?: ConstructorParameters<typeof Dexie>[1], name = DB_NAME): KitabaDb {
  const db = new Dexie(name, options) as KitabaDb;
  // v1: typing, spelling, sentences and professional writing (V1 product).
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
  // v2: spelling only (DECISIONS V3). Drops the V1-only stores and reshapes the rest
  // with the same pure rules used to import v1 export files.
  db.version(2)
    .stores({
      ...Object.fromEntries(V1_DROPPED_TABLES.map((t) => [t, null])),
      sessions: "id, at, mode, updatedAt",
      stages: "id, updatedAt",
    })
    .upgrade(async (tx) => {
      for (const table of MIGRATED_TABLES) {
        await tx
          .table(table)
          .toCollection()
          .modify((row: Record<string, unknown>, ref: { value?: unknown }) => {
            const next = migrateV1Row(table, row);
            if (next === null) delete ref.value;
            else ref.value = next;
          });
      }
      // Pending cloud writes: drop those for removed tables, migrate the rest.
      await tx
        .table("outbox")
        .toCollection()
        .modify((item: OutboxItem, ref: { value?: unknown }) => {
          const next = migrateV1Row(item.table, item.record as unknown as Record<string, unknown>);
          if (next === null) delete ref.value;
          else ref.value = { ...item, record: next };
        });
    });
  // v3: three learner levels (words, sentences, tests) on the profile (DECISIONS E3). No index changes.
  db.version(3)
    .stores({})
    .upgrade(async (tx) => {
      await tx
        .table("profile")
        .toCollection()
        .modify((row: Record<string, unknown>, ref: { value?: unknown }) => {
          ref.value = migrateProfileRow(row);
        });
      await tx
        .table("outbox")
        .toCollection()
        .modify((item: OutboxItem, ref: { value?: unknown }) => {
          if (item.table === "profile") ref.value = { ...item, record: migrateProfileRow(item.record as unknown as Record<string, unknown>) };
        });
    });
  // v4: sentences and messages (DECISIONS F6): writing history and the learner's own dictionary.
  db.version(4).stores({ writings: "id, at, updatedAt", dictionary: "id, updatedAt" });
  return db;
}

const ALL_STORES = [...TABLE_NAMES, "outbox", "meta"];

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
      await db.transaction("rw", ALL_STORES, async () => {
        // The device's link to an account survives (DECISIONS A9): deleting progress on a
        // signed-in device must not make the account's own data look like unlinked guest progress.
        const kept = (await db.meta.bulkGet([...KEPT_META_KEYS])).filter((m): m is MetaRow => m !== undefined);
        await Promise.all(ALL_STORES.map((n) => db.table(n).clear()));
        if (kept.length > 0) await db.meta.bulkPut(kept);
      });
    },
    atomic: (work) => db.transaction("rw", ALL_STORES, work),
  };
}
