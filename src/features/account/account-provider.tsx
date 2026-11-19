"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { TABLE_NAMES } from "@/domain/model";
import { decideFirstSync } from "@/domain/sync/session";
import { isSupabaseConfigured, loadSupabase } from "@/lib/supabase/client";
import { downloadJson, exportFilename } from "@/lib/download";
import { createRepositories } from "@/repositories/create";
import { createSupabaseStore } from "@/repositories/supabase/store";
import { useRepoContext } from "@/repositories/provider";
import { SyncEngine, type SyncSnapshot } from "./sync-engine";
import { MergeDialog, type MergeChoice } from "./merge-dialog";

const LINKED_KEY = "linkedUser";
const FLUSH_TIMEOUT_MS = 5000;

interface AccountValue {
  readonly configured: boolean;
  readonly client: SupabaseClient | null;
  readonly user: User | null;
  /** True once the initial session check finished. */
  readonly ready: boolean;
  readonly sync: SyncSnapshot | null;
  readonly syncNow: () => Promise<void>;
  /** Signs out; by default also removes this account's progress from the device (shared devices). */
  readonly signOut: (opts: { removeLocalData: boolean }) => Promise<void>;
  /** Exports everything stored in the cloud for this account. */
  readonly exportCloud: () => Promise<void>;
  /** Deletes the account, its cloud data and its data on this device. */
  readonly deleteAccount: () => Promise<void>;
  /** Accounts are configured, but the account library could not be loaded (for example offline). */
  readonly unavailable: boolean;
  /** Tries to load the account library again. */
  readonly retryLoad: () => void;
}

const AccountContext = createContext<AccountValue | null>(null);

const withTimeout = (p: Promise<void>, ms: number) => Promise.race([p, new Promise<void>((r) => setTimeout(r, ms))]);

export function AccountProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const { baseStore, outbox, onWrite, invalidate, repos } = useRepoContext();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!configured);
  const [sync, setSync] = useState<SyncSnapshot | null>(null);
  const [askMerge, setAskMerge] = useState(false);
  const engineRef = useRef<SyncEngine | null>(null);
  const userId = user?.id ?? null;

  // The Supabase library loads on demand; until then (and if it cannot load) the learner is a guest.
  const [loadTry, setLoadTry] = useState(0);
  const retryLoad = useCallback(() => setLoadTry((n) => n + 1), []);
  useEffect(() => {
    if (!configured) return;
    let alive = true;
    loadSupabase()
      .then((c) => {
        if (!alive) return;
        setClient(c);
        if (!c) setReady(true);
      })
      .catch(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [configured, loadTry]);

  // A failed load is retried when the connection comes back.
  useEffect(() => {
    if (!configured || client) return;
    window.addEventListener("online", retryLoad);
    return () => window.removeEventListener("online", retryLoad);
  }, [configured, client, retryLoad]);

  // Session: initial check + changes (sign-in, sign-out, password recovery).
  useEffect(() => {
    if (!client) return;
    let alive = true;
    void client.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setUser(data.session?.user ?? null);
      setReady(true);
    });
    const { data } = client.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setReady(true);
      if (event === "PASSWORD_RECOVERY") router.push("/account/reset");
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, [client, router]);

  const stopEngine = useCallback(async () => {
    const engine = engineRef.current;
    engineRef.current = null;
    setSync(null);
    await engine?.stopAndWait();
  }, []);

  const startEngine = useCallback(
    async (uid: string, fullResync: boolean) => {
      if (!client) return null;
      await stopEngine();
      if (fullResync) await outbox.setMeta(`cursor:${uid}`, null);
      const engine = new SyncEngine({
        userId: uid,
        local: baseStore,
        remote: createSupabaseStore(client),
        outbox,
        onChange: setSync,
        onLocalData: invalidate,
        currentUserId: async () => (await client.auth.getSession()).data.session?.user.id ?? null,
      });
      engineRef.current = engine;
      engine.start();
      return engine;
    },
    [client, baseStore, outbox, invalidate, stopEngine],
  );

  // Account changes (including A → B without a sign-out in between) always stop the old engine first.
  // First sign-in on this device never mixes or replaces local progress without asking.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await stopEngine();
      if (!userId || !client || cancelled) return;
      const linked = (await outbox.getMeta<string | null>(LINKED_KEY)) ?? null;
      let localHasData = false;
      for (const t of TABLE_NAMES) {
        if ((await baseStore.all(t)).length > 0) {
          localHasData = true;
          break;
        }
      }
      if (cancelled) return;
      const decision = decideFirstSync({ linkedUserId: linked, userId, localHasData });
      if (decision === "ask") {
        setAskMerge(true);
        return;
      }
      if (decision === "adopt-remote") {
        await outbox.clear(); // anything queued belonged to a previous account
        await outbox.setMeta(LINKED_KEY, userId);
      }
      if (!cancelled) await startEngine(userId, decision === "adopt-remote");
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, client, outbox, baseStore, startEngine, stopEngine]);

  // Queue every local write while linked to an account.
  useEffect(
    () =>
      onWrite((table, records) => {
        const engine = engineRef.current;
        if (engine) void engine.enqueue(table, records);
      }),
    [onWrite],
  );

  useEffect(() => () => engineRef.current?.stop(), []);

  const chooseMerge = useCallback(
    async (choice: MergeChoice) => {
      if (!userId) return;
      if (choice === "backup") {
        downloadJson(await repos.data.exportAll(), exportFilename("kitaba-local-backup"));
        return;
      }
      await outbox.clear(); // only this device's data, queued below, may go to this account
      if (choice === "merge") {
        await outbox.setMeta(LINKED_KEY, userId);
        const engine = await startEngine(userId, true);
        await engine?.enqueueAllLocal();
        await engine?.syncNow();
      } else {
        await baseStore.clear();
        await outbox.setMeta(LINKED_KEY, userId);
        invalidate();
        const engine = await startEngine(userId, true);
        await engine?.syncNow();
      }
      setAskMerge(false);
    },
    [userId, outbox, startEngine, repos, baseStore, invalidate],
  );

  const value = useMemo<AccountValue>(
    () => ({
      configured,
      client,
      unavailable: configured && ready && !client,
      retryLoad,
      user,
      ready,
      sync,
      syncNow: async () => {
        await engineRef.current?.syncNow();
      },
      signOut: async ({ removeLocalData }) => {
        // Try to send anything still queued before leaving.
        const engine = engineRef.current;
        if (engine) await withTimeout(engine.syncNow(), FLUSH_TIMEOUT_MS);
        await stopEngine();
        await outbox.clear();
        await outbox.setMeta(LINKED_KEY, null);
        if (removeLocalData) {
          await baseStore.clear();
          invalidate();
        }
        await client?.auth.signOut();
      },
      exportCloud: async () => {
        if (!client) return;
        const cloud = createRepositories({ store: createSupabaseStore(client) });
        downloadJson(await cloud.data.exportAll(), exportFilename("kitaba-cloud"));
      },
      deleteAccount: async () => {
        if (!client) return;
        await stopEngine();
        const { error } = await client.rpc("delete_my_account");
        if (error) throw new Error(error.message);
        // "Delete my account and all my data": this device's copy goes too.
        await outbox.clear();
        await outbox.setMeta(LINKED_KEY, null);
        await baseStore.clear();
        invalidate();
        await client.auth.signOut();
      },
    }),
    [configured, client, user, ready, sync, outbox, baseStore, invalidate, stopEngine, retryLoad],
  );

  return (
    <AccountContext.Provider value={value}>
      {children}
      <MergeDialog open={askMerge} onChoose={chooseMerge} />
    </AccountContext.Provider>
  );
}

export function useAccount(): AccountValue {
  const v = useContext(AccountContext);
  if (!v) throw new Error("useAccount must be used inside AccountProvider");
  return v;
}
