import type { TableMap, TableName } from "@/domain/model";

/**
 * Storage backend contract. Repositories are written once against this
 * interface; Dexie (local), in-memory (tests) and Supabase (cloud) implement it.
 * `all` returns tombstoned records too; repositories filter them.
 */
export interface RecordStore {
  all<T extends TableName>(table: T): Promise<TableMap[T][]>;
  get<T extends TableName>(table: T, id: string): Promise<TableMap[T] | undefined>;
  put<T extends TableName>(table: T, record: TableMap[T]): Promise<void>;
  bulkPut<T extends TableName>(table: T, records: readonly TableMap[T][]): Promise<void>;
  /** Removes every record in every table (local data reset). */
  clear(): Promise<void>;
}

/** In-memory backend used by tests and as a fallback when IndexedDB is unavailable (e.g. some private modes). */
export function createMemoryStore(): RecordStore {
  const tables = new Map<TableName, Map<string, unknown>>();
  const table = (name: TableName) => {
    let t = tables.get(name);
    if (!t) {
      t = new Map();
      tables.set(name, t);
    }
    return t;
  };
  const clone = <V>(v: V): V => structuredClone(v);
  return {
    async all(name) {
      return [...table(name).values()].map(clone) as never;
    },
    async get(name, id) {
      const v = table(name).get(id);
      return v === undefined ? undefined : (clone(v) as never);
    },
    async put(name, record) {
      table(name).set(record.id, clone(record));
    },
    async bulkPut(name, records) {
      for (const r of records) table(name).set(r.id, clone(r));
    },
    async clear() {
      tables.clear();
    },
  };
}
