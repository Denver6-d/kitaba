"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { TABLE_NAMES } from "@/domain/model";
import { decideFirstSync } from "@/domain/sync/session";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { downloadJson, exportFilename } from "@/lib/download";
import { createRepositories } from "@/repositories/create";
import { createSupabaseStore } from "@/repositories/supabase/store";
import { useRepoContext } from "@/repositories/provider";
import { SyncEngine, type SyncSnapshot } from "./sync-engine";
import { MergeDialog } from "./merge-dialog";

const LINKED_KEY = "linkedUser";

interface AccountValue {
  readonly configured: boolean;
  readonly client: SupabaseClient | null;
  readonly user: User | null;
  /** True once the initial session check finished. */
  readonly ready: boolean;
  readonly sync: SyncSnapshot | null;
  readonly syncNow: () => Promise<void>;
  readonly signOut: () => Promise<void>;
  /** Exports everything stored in the cloud for this account. */
  readonly exportCloud: () => Promise<void>;
  readonly deleteAccount: () => Promise<void>;
}

const AccountContext = createContext<AccountValue | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [client] = useState<SupabaseClient | null>(() => getSupabase());
  const { baseStore, outbox, onWrite, invalidate, repos } = useRepoContext();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!configured);
  const [sync, setSync] = useState<SyncSnapshot | null>(null);
  const [askMerge, setAskMerge] = useState(false);
  const engineRef = useRef<SyncEngine | null>(null);
  const userId = user?.id ?? null;

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

  const startEngine = useCallback(
    (uid: string) => {
      if (!client) return null;
      engineRef.current?.stop();
      const engine = new SyncEngine({
        userId: uid,
        local: baseStore,
        remote: createSupabaseStore(client),
        outbox,
        onChange: setSync,
        onLocalData: invalidate,
      });
      engineRef.current = engine;
      engine.start();
      return engine;
    },
    [client, baseStore, outbox, invalidate],
  );

  // First sign-in on this device: never mix or replace local progress without asking.
  useEffect(() => {
    if (!userId || !client) {
      engineRef.current?.stop();
      engineRef.current = null;
      return;
    }
    let cancelled = false;
    void (async () => {
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
        await outbox.setMeta(LINKED_KEY, userId);
        await outbox.setMeta(`cursor:${userId}`, null);
      }
      if (!cancelled) startEngine(userId);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, client, outbox, baseStore, startEngine]);

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
    async (merge: boolean) => {
      if (!userId) return;
      if (merge) {
        await outbox.setMeta(LINKED_KEY, userId);
        await outbox.setMeta(`cursor:${userId}`, null);
        const engine = startEngine(userId);
        await engine?.enqueueAllLocal();
        await engine?.syncNow();
      } else {
        // Keep a copy of the local progress before replacing it with the account's.
        downloadJson(await repos.data.exportAll(), exportFilename("kitaba-local-backup"));
        await baseStore.clear();
        await outbox.clear();
        await outbox.setMeta(LINKED_KEY, userId);
        invalidate();
        const engine = startEngine(userId);
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
      user,
      ready,
      sync,
      syncNow: async () => {
        await engineRef.current?.syncNow();
      },
      signOut: async () => {
        engineRef.current?.stop();
        engineRef.current = null;
        setSync(null);
        // Local progress stays on this device as guest data; it is no longer linked.
        await outbox.setMeta(LINKED_KEY, null);
        await client?.auth.signOut();
      },
      exportCloud: async () => {
        if (!client) return;
        const cloud = createRepositories({ store: createSupabaseStore(client) });
        downloadJson(await cloud.data.exportAll(), exportFilename("kitaba-cloud"));
      },
      deleteAccount: async () => {
        if (!client) return;
        const { error } = await client.rpc("delete_my_account");
        if (error) throw new Error(error.message);
        engineRef.current?.stop();
        engineRef.current = null;
        setSync(null);
        await outbox.clear();
        await outbox.setMeta(LINKED_KEY, null);
        await client.auth.signOut();
      },
    }),
    [configured, client, user, ready, sync, outbox],
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
