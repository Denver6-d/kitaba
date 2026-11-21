import type { OfflineStatus } from "./library";

/** Anything Settings can store for offline play: the word library, the pronunciation audio. */
export interface OfflineSource {
  offlineStatus(): Promise<OfflineStatus>;
  downloadAll(onProgress: (stored: number, total: number) => void, signal?: AbortSignal): Promise<boolean>;
  removeOffline(): Promise<void>;
}

/**
 * "The full library offline" as one download (DECISIONS AU10): the first
 * source (the word library) decides the status; the others are added when they
 * are reachable and skipped when they are not, so missing audio never blocks
 * the words. Progress is reported over the combined size.
 */
export function combineOffline(main: OfflineSource, ...extra: OfflineSource[]): OfflineSource {
  const all = [main, ...extra];

  async function statuses(): Promise<OfflineStatus[]> {
    return Promise.all(all.map((s) => s.offlineStatus().catch((): OfflineStatus => ({ kind: "unreachable" }))));
  }

  async function offlineStatus(): Promise<OfflineStatus> {
    const [first, ...rest] = await statuses();
    if (!first || first.kind !== "ready") return first ?? { kind: "unreachable" };
    let { stored, total } = first;
    for (const s of rest) {
      if (s.kind !== "ready") continue;
      stored += s.stored;
      total += s.total;
    }
    return { kind: "ready", stored, total };
  }

  async function downloadAll(onProgress: (stored: number, total: number) => void, signal?: AbortSignal): Promise<boolean> {
    const st = await statuses();
    if (st[0]?.kind !== "ready") return false;
    const sizes = st.map((s) => (s.kind === "ready" ? s.total : 0));
    const total = sizes.reduce((a, b) => a + b, 0);
    let before = 0;
    for (let i = 0; i < all.length; i++) {
      if (st[i]?.kind !== "ready") continue;
      const base = before;
      const ok = await all[i]!.downloadAll((stored) => onProgress(base + stored, total), signal);
      if (!ok) return false;
      before += sizes[i]!;
    }
    return true;
  }

  async function removeOffline(): Promise<void> {
    await Promise.all(all.map((s) => s.removeOffline().catch(() => undefined)));
  }

  return { offlineStatus, downloadAll, removeOffline };
}
