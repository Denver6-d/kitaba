import type { SyncRecord, TableName } from "@/domain/model";
import type { RecordStore } from "./store";

export type WriteListener = (table: TableName, records: readonly SyncRecord[]) => void;

/**
 * Decorates a store so every write is announced. The UI uses this to refresh
 * views, and the sync engine uses it to queue changes for the cloud.
 * The repositories never know they are being observed.
 */
export function observeStore(store: RecordStore): { store: RecordStore; subscribe: (l: WriteListener) => () => void; emitClear: () => void } {
  const listeners = new Set<WriteListener>();
  const clearListeners = new Set<() => void>();
  const emit = (table: TableName, records: readonly SyncRecord[]) => {
    for (const l of listeners) l(table, records);
  };
  return {
    store: {
      all: (t) => store.all(t),
      get: (t, id) => store.get(t, id),
      async put(t, r) {
        await store.put(t, r);
        emit(t, [r]);
      },
      async bulkPut(t, rs) {
        await store.bulkPut(t, rs);
        if (rs.length > 0) emit(t, rs);
      },
      async clear() {
        await store.clear();
        for (const l of clearListeners) l();
      },
    },
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    emitClear() {
      for (const l of clearListeners) l();
    },
  };
}
