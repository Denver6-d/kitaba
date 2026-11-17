import { TABLE_NAMES, type SyncRecord, type TableMap, type TableName } from "@/domain/model";
import { nextRetryDelay } from "@/domain/sync/outbox";
import { PULL_OVERLAP_MS, reconcilePulled } from "@/domain/sync/session";
import type { OutboxStore } from "@/repositories/local/outbox";
import type { RecordStore } from "@/repositories/store";
import type { SupabaseRemote } from "@/repositories/supabase/store";

export type SyncStatus = "idle" | "syncing" | "synced" | "offline" | "error";

export interface SyncSnapshot {
  readonly status: SyncStatus;
  readonly pending: number;
}

interface Deps {
  readonly userId: string;
  /** The local store WITHOUT the write observer (pulled data must not be re-queued). */
  readonly local: RecordStore;
  readonly remote: SupabaseRemote;
  readonly outbox: OutboxStore;
  readonly onChange: (s: SyncSnapshot) => void;
  /** Called after pulled data was written locally, so views refresh. */
  readonly onLocalData: () => void;
}

const PUSH_BATCH = 200;
const PERIODIC_MS = 60_000;
const DEBOUNCE_MS = 1500;

/**
 * Offline-tolerant sync: local writes are queued in the outbox, pushed when
 * online (with backoff on failure), then remote changes are pulled and merged
 * with the tested domain rules (domain/sync). The UI always reads local data.
 */
export class SyncEngine {
  private status: SyncStatus = "idle";
  private pending = 0;
  private running: Promise<void> | null = null;
  private again = false;
  private attempt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private periodic: ReturnType<typeof setInterval> | null = null;
  private stopped = false;
  private listening = false;

  constructor(private readonly d: Deps) {}

  private get cursorKey() {
    return `cursor:${this.d.userId}`;
  }

  start(): void {
    this.listening = true;
    window.addEventListener("online", this.onOnline);
    window.addEventListener("offline", this.onOffline);
    document.addEventListener("visibilitychange", this.onVisible);
    this.periodic = setInterval(() => void this.syncNow(), PERIODIC_MS);
    void this.refreshPending().then(() => this.syncNow());
  }

  stop(): void {
    this.stopped = true;
    if (this.listening) {
      window.removeEventListener("online", this.onOnline);
      window.removeEventListener("offline", this.onOffline);
      document.removeEventListener("visibilitychange", this.onVisible);
      this.listening = false;
    }
    if (this.periodic) clearInterval(this.periodic);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  /** Queue local writes (called by the store observer) and sync shortly after. */
  async enqueue(table: TableName, records: readonly SyncRecord[]): Promise<void> {
    await this.d.outbox.add(table, records);
    await this.refreshPending();
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => void this.syncNow(), DEBOUNCE_MS);
  }

  /** Queue every local record (used when merging local progress into an account). */
  async enqueueAllLocal(): Promise<void> {
    for (const table of TABLE_NAMES) {
      const rows = await this.d.local.all(table);
      if (rows.length > 0) await this.d.outbox.add(table, rows);
    }
    await this.refreshPending();
  }

  /** Forget the pull cursor so the next sync reads the whole account. */
  async resetCursor(): Promise<void> {
    await this.d.outbox.setMeta(this.cursorKey, null);
  }

  syncNow(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = this.run().finally(() => {
      this.running = null;
      if (this.again && !this.stopped) {
        this.again = false;
        void this.syncNow();
      }
    });
    return this.running;
  }

  private async run(): Promise<void> {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      this.set("offline");
      return;
    }
    this.set("syncing");
    try {
      await this.push();
      await this.pull();
      this.attempt = 0;
      await this.refreshPending();
      this.set("synced");
    } catch {
      await this.refreshPending();
      this.set(typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "error");
      this.scheduleRetry();
    }
  }

  private async push(): Promise<void> {
    for (;;) {
      const batch = await this.d.outbox.list(PUSH_BATCH);
      if (batch.length === 0) return;
      await this.d.remote.upsert(batch.map((i) => ({ table: i.table, record: i.record })));
      await this.d.outbox.ack(batch);
      await this.refreshPending();
    }
  }

  private async pull(): Promise<void> {
    const cursor = await this.d.outbox.getMeta<string | null>(this.cursorKey);
    const since = cursor ? new Date(new Date(cursor).getTime() - PULL_OVERLAP_MS).toISOString() : null;
    const { records, cursor: next } = await this.d.remote.pullSince(since);
    let wroteLocal = false;
    const resend: Array<{ table: TableName; record: SyncRecord }> = [];
    for (const { table, record } of records) {
      const local = await this.d.local.get(table, record.id);
      const r = reconcilePulled(table, local, record as TableMap[typeof table]);
      if (r.toLocal) {
        await this.d.local.put(table, r.toLocal);
        wroteLocal = true;
      }
      if (r.toRemote) resend.push({ table, record: r.toRemote });
    }
    for (const x of resend) await this.d.outbox.add(x.table, [x.record]);
    if (next) await this.d.outbox.setMeta(this.cursorKey, next);
    if (wroteLocal) this.d.onLocalData();
    if (resend.length > 0) await this.push();
  }

  private scheduleRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    const delay = nextRetryDelay(this.attempt);
    this.attempt += 1;
    this.retryTimer = setTimeout(() => void this.syncNow(), delay);
  }

  private async refreshPending(): Promise<void> {
    this.pending = await this.d.outbox.count();
    this.emit();
  }

  private set(status: SyncStatus): void {
    this.status = status;
    this.emit();
  }

  private emit(): void {
    if (!this.stopped) this.d.onChange({ status: this.status, pending: this.pending });
  }

  private onOnline = () => void this.syncNow();
  private onOffline = () => this.set("offline");
  private onVisible = () => {
    if (document.visibilityState === "visible") void this.syncNow();
  };
}
