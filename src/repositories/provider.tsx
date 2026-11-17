"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createRepositories } from "./create";
import { createDexieStore, openDb, type KitabaDb } from "./local/db";
import { createDexieOutbox, createMemoryOutbox, type OutboxStore } from "./local/outbox";
import { observeStore, type WriteListener } from "./observe";
import { createMemoryStore, type RecordStore } from "./store";
import type { Repositories } from "./types";

interface RepoContextValue {
  readonly repos: Repositories;
  /** Observed store: writes through it are announced (UI refresh, sync queue). */
  readonly store: RecordStore;
  /** The same data without the observer, for the sync engine's own writes. */
  readonly baseStore: RecordStore;
  readonly outbox: OutboxStore;
  readonly db: KitabaDb | null;
  /** Increments after every write; components re-query when it changes. */
  readonly revision: number;
  readonly onWrite: (l: WriteListener) => () => void;
  /** Bump the revision after out-of-band writes (e.g. a sync pull). */
  readonly invalidate: () => void;
  readonly persistent: boolean;
}

const RepoContext = createContext<RepoContextValue | null>(null);

interface LocalBackend {
  readonly store: RecordStore;
  readonly outbox: OutboxStore;
  readonly db: KitabaDb | null;
  readonly persistent: boolean;
}

function createLocal(): LocalBackend {
  try {
    if (typeof indexedDB === "undefined") throw new Error("no indexeddb");
    const db = openDb();
    return { store: createDexieStore(db), outbox: createDexieOutbox(db), db, persistent: true };
  } catch {
    // Private modes without IndexedDB still work for the session.
    return { store: createMemoryStore(), outbox: createMemoryOutbox(), db: null, persistent: false };
  }
}

/**
 * Provides the repositories to the app. The UI only ever sees the
 * Repositories interfaces; which backend sits underneath is decided here.
 */
export function RepositoriesProvider({ children }: { children: ReactNode }) {
  // Lazy initial state: runs once per environment (memory on the server, IndexedDB in the browser).
  const [backend] = useState<LocalBackend>(() =>
    typeof window === "undefined" ? { store: createMemoryStore(), outbox: createMemoryOutbox(), db: null, persistent: false } : createLocal(),
  );
  const observed = useMemo(() => observeStore(backend.store), [backend]);
  const repos = useMemo(() => createRepositories({ store: observed.store }), [observed]);
  const [revision, setRevision] = useState(0);
  const invalidate = useCallback(() => setRevision((r) => r + 1), []);

  useEffect(() => {
    const offWrite = observed.subscribe(() => invalidate());
    const offClear = observed.subscribeClear(invalidate);
    return () => {
      offWrite();
      offClear();
    };
  }, [observed, invalidate]);

  const value = useMemo<RepoContextValue>(
    () => ({
      repos,
      store: observed.store,
      baseStore: backend.store,
      outbox: backend.outbox,
      db: backend.db,
      revision,
      onWrite: observed.subscribe,
      invalidate,
      persistent: backend.persistent,
    }),
    [repos, observed, backend, revision, invalidate],
  );

  return <RepoContext.Provider value={value}>{children}</RepoContext.Provider>;
}

export function useRepoContext(): RepoContextValue {
  const v = useContext(RepoContext);
  if (!v) throw new Error("useRepos must be used inside RepositoriesProvider");
  return v;
}

export function useRepos(): Repositories {
  return useRepoContext().repos;
}

export type AsyncState<T> =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly error: unknown }
  | { readonly status: "ready"; readonly data: T };

/** Runs a repository query and re-runs it whenever data changes. */
export function useRepoQuery<T>(query: (repos: Repositories) => Promise<T>, deps: readonly unknown[] = []): AsyncState<T> & { reload: () => void } {
  const { repos, revision } = useRepoContext();
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });
  const [nonce, setNonce] = useState(0);
  const queryRef = useRef(query);
  useEffect(() => {
    queryRef.current = query;
  });

  useEffect(() => {
    let alive = true;
    queryRef
      .current(repos)
      .then((data) => {
        if (alive) setState({ status: "ready", data });
      })
      .catch((error: unknown) => {
        if (alive) setState({ status: "error", error });
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are the caller's query inputs
  }, [repos, revision, nonce, ...deps]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}
