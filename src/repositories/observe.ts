import type { SyncRecord, TableName } from "@/domain/model";
import type { RecordStore } from "./store";

export type WriteListener = (table: TableName, records: readonly SyncRecord[]) => void;

/**
 * Decorates a store so every write is announced. The UI uses this to refresh
 * views, and the sync engine uses it to queue changes for the cloud.
 * The repositories never know they are being observed.
 */
export interface ObservedStore {
  readonly store: RecordStore;
  readonly subscribe: (l: WriteListener) => () => void;
  readonly subscribeClear: (l: () => void) => () => void;
}

export function observeStore(store: RecordStore): ObservedStore {
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
      atomic: (work) => store.atomic(work),
    },
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    subscribeClear(l) {
      clearListeners.add(l);
      return () => clearListeners.delete(l);
    },
  };
}
