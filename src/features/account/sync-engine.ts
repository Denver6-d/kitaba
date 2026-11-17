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
  /** The user the network client is currently signed in as (guards against account switches mid-run). */
  readonly currentUserId?: () => Promise<string | null>;
}

const PUSH_BATCH = 200;
const PERIODIC_MS = 60_000;
const DEBOUNCE_MS = 1500;

/** Postgres returns microseconds and "+00:00"; trim to milliseconds so every browser parses it. */
export function parseServerTime(ts: string): number {
  const ms = Date.parse(ts.replace(/(\.\d{3})\d+/, "$1"));
  return Number.isFinite(ms) ? ms : 0;
}

class Stopped extends Error {}

/**
 * Offline-tolerant sync: local writes are queued in the outbox, pushed when
 * online (with backoff on failure), then remote changes are pulled and merged
 * with the tested domain rules (domain/sync). The UI always reads local data.
 * stop() cancels a running pass before its next write.
 */
export class SyncEngine {
  private status: SyncStatus = "idle";
  private pending = 0;
  private running: Promise<void> | null = null;
  private followUp: Promise<void> | null = null;
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
    this.periodic = setInterval(() => this.auto(), PERIODIC_MS);
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
    this.retryTimer = null;
  }

  /** Stops and waits for any running pass to wind down (it aborts before its next write). */
  async stopAndWait(): Promise<void> {
    this.stop();
    await this.running?.catch(() => {});
  }

  /** Queue local writes (called by the store observer) and sync shortly after. */
  async enqueue(table: TableName, records: readonly SyncRecord[]): Promise<void> {
    if (this.stopped) return;
    await this.d.outbox.add(table, records);
    await this.refreshPending();
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.auto(), DEBOUNCE_MS);
  }

  /** Queue every local record (used when merging local progress into an account). */
  async enqueueAllLocal(): Promise<void> {
    for (const table of TABLE_NAMES) {
      const rows = await this.d.local.all(table);
      if (rows.length > 0) await this.d.outbox.add(table, rows);
    }
    await this.refreshPending();
  }

  /**
   * Run a sync pass now. If one is running, a follow-up pass is scheduled and
   * the returned promise settles after it, so callers know their writes were attempted.
   */
  syncNow(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.running) {
      this.again = true;
      return this.running.then(() => this.followUp ?? undefined);
    }
    this.running = this.run().finally(() => {
      this.running = null;
      this.followUp = null;
      if (this.again && !this.stopped) {
        this.again = false;
        this.followUp = this.syncNow();
      }
    });
    return this.running;
  }

  /** Automatic triggers respect the backoff after a failure; manual ones (syncNow, online) do not. */
  private auto(): void {
    if (this.retryTimer === null) void this.syncNow();
  }

  private guard(): void {
    if (this.stopped) throw new Stopped();
  }

  private async run(): Promise<void> {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      this.set("offline");
      return;
    }
    this.set("syncing");
    try {
      if (this.d.currentUserId && (await this.d.currentUserId()) !== this.d.userId) {
        this.stop(); // the session belongs to someone else now: never push or pull across accounts
        return;
      }
      await this.push();
      await this.pull();
      this.attempt = 0;
      await this.refreshPending();
      this.set("synced");
    } catch (e) {
      if (e instanceof Stopped || this.stopped) return;
      await this.refreshPending();
      this.set(typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "error");
      this.scheduleRetry();
    }
  }

  private async push(): Promise<void> {
    for (;;) {
      this.guard();
      const batch = await this.d.outbox.list(PUSH_BATCH);
      if (batch.length === 0) return;
      this.guard();
      await this.d.remote.upsert(batch.map((i) => ({ table: i.table, record: i.record })));
      this.guard();
      await this.d.outbox.ack(batch);
      await this.refreshPending();
    }
  }

  private async pull(): Promise<void> {
    const cursor = await this.d.outbox.getMeta<string | null>(this.cursorKey);
    const since = cursor ? new Date(Math.max(0, parseServerTime(cursor) - PULL_OVERLAP_MS)).toISOString() : null;
    const { records, cursor: next } = await this.d.remote.pullSince(since);
    this.guard();
    const resend: Array<{ table: TableName; record: SyncRecord }> = [];
    let wroteLocal = false;
    // One transaction: a concurrent local write cannot interleave with the merge.
    await this.d.local.atomic(async () => {
      for (const { table, record } of records) {
        this.guard();
        const local = await this.d.local.get(table, record.id);
        const r = reconcilePulled(table, local, record as TableMap[typeof table]);
        if (r.toLocal) {
          await this.d.local.put(table, r.toLocal);
          wroteLocal = true;
        }
        if (r.toRemote) resend.push({ table, record: r.toRemote });
      }
    });
    this.guard();
    for (const x of resend) await this.d.outbox.add(x.table, [x.record]);
    if (next) await this.d.outbox.setMeta(this.cursorKey, next);
    if (wroteLocal) this.d.onLocalData();
    if (resend.length > 0) await this.push();
  }

  private scheduleRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    const delay = nextRetryDelay(this.attempt);
    this.attempt += 1;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.syncNow();
    }, delay);
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

  private onOnline = () => {
    this.attempt = 0;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    void this.syncNow();
  };
  private onOffline = () => this.set("offline");
  private onVisible = () => {
    if (document.visibilityState === "visible") this.auto();
  };
}
