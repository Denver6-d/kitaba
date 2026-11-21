import { audioIndexSchema, audioManifestSchema, commonsPage, type AudioIndex, type AudioManifest, type RecordingCredit } from "@/data/audio-schema";
import type { CefrLevel } from "@/domain/model";
import type { OfflineStatus } from "@/features/library/library";

/**
 * Pronunciation audio, loaded on demand (DECISIONS "Pronunciation audio").
 *
 * - The manifest is fetched network-first (a deploy with new audio is seen at
 *   once); a level's index only when a game plays that level; a word's MP3
 *   only when it is played (or prefetched for the current game).
 * - Indexes and MP3s have content hashes in their names: cache-first, in one
 *   Cache Storage cache shared with the service worker. It is separate from the
 *   library's cache, whose pruning only knows the library's own files.
 * - Every index is validated with zod; files are played from a Blob URL, so a
 *   cached copy plays offline without range requests.
 * - Any failure resolves to "no file": the caller speaks the word with Web
 *   Speech instead (lib/pronounce.ts).
 */

export const AUDIO_BASE = "/audio/v1/";
/** Also named in public/sw.js; kept across service-worker updates. */
export const AUDIO_CACHE = "kitaba-audio-v1";

export interface AudioDeps {
  readonly fetch: (url: string, init?: RequestInit) => Promise<Response>;
  readonly caches?: CacheStorage | undefined;
  /** URL.createObjectURL in the browser. */
  readonly objectUrl: (blob: Blob) => string;
}

/** What is known about one word's file once its level's index is loaded. */
export interface AudioEntry {
  readonly path: string;
  /** null for the generated voice. */
  readonly credit: RecordingCredit | null;
}

export interface AudioLibrary {
  manifest(): Promise<AudioManifest | null>;
  /** Loads one level's index (memoised); null when unavailable. */
  loadLevel(level: CefrLevel): Promise<AudioIndex | null>;
  /** Synchronous lookup in the indexes loaded so far. */
  entry(id: string, level: CefrLevel): AudioEntry | null;
  /** A playable URL for the word's file, fetched cache-first; null when there is none or it failed. */
  url(id: string, level: CefrLevel): Promise<string | null>;
  offlineStatus(): Promise<OfflineStatus>;
  downloadAll(onProgress: (stored: number, total: number) => void, signal?: AbortSignal): Promise<boolean>;
  removeOffline(): Promise<void>;
}

const DOWNLOAD_CONCURRENCY = 6;

export function createAudioLibrary(deps: AudioDeps): AudioLibrary {
  let manifestP: Promise<AudioManifest | null> | null = null;
  const levels = new Map<CefrLevel, Promise<AudioIndex | null>>();
  const loaded = new Map<CefrLevel, AudioIndex>();
  const urls = new Map<string, Promise<string | null>>();

  const openCache = async (): Promise<Cache | null> => {
    try {
      return deps.caches ? await deps.caches.open(AUDIO_CACHE) : null;
    } catch {
      return null;
    }
  };

  /** Every path the manifest refers to: the indexes and their files. */
  const pathsOf = (m: AudioManifest, indexes: readonly AudioIndex[]): string[] => [
    ...Object.values(m.levels).map((l) => l.index),
    ...indexes.flatMap((ix) => Object.values(ix.files).map((e) => `${ix.level}/${e[0]}`)),
  ];

  async function readManifest(): Promise<AudioManifest | null> {
    const url = `${AUDIO_BASE}manifest.json`;
    const cache = await openCache();
    try {
      const res = await deps.fetch(url, { cache: "no-cache" });
      if (!res.ok) throw new Error(String(res.status));
      if (cache) await cache.put(url, res.clone()).catch(() => undefined);
      return audioManifestSchema.parse(await res.json());
    } catch {
      const hit = await cache?.match(url).catch(() => undefined);
      if (!hit) return null;
      try {
        return audioManifestSchema.parse(await hit.json());
      } catch {
        return null;
      }
    }
  }

  function manifest(): Promise<AudioManifest | null> {
    manifestP ??= readManifest().then((m) => {
      if (!m) manifestP = null; // retry later instead of remembering a failure
      return m;
    });
    return manifestP;
  }

  async function fetchFile(path: string, init?: RequestInit): Promise<Response> {
    const url = AUDIO_BASE + path;
    const cache = await openCache();
    const hit = await cache?.match(url).catch(() => undefined);
    if (hit) return hit;
    const res = await deps.fetch(url, init);
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    if (cache) await cache.put(url, res.clone()).catch(() => undefined);
    return res;
  }

  function loadLevel(level: CefrLevel): Promise<AudioIndex | null> {
    let p = levels.get(level);
    if (!p) {
      p = (async () => {
        const m = await manifest();
        const ref = m?.levels[level];
        if (!ref) return null;
        const ix = audioIndexSchema.parse(await (await fetchFile(ref.index)).json());
        if (ix.level !== level) throw new Error("index level mismatch");
        loaded.set(level, ix);
        return ix;
      })().catch(() => null);
      // A failure (or a missing manifest) is not remembered: the next game asks again.
      void p.then((ix) => {
        if (!ix) levels.delete(level);
      });
      levels.set(level, p);
    }
    return p;
  }

  function entry(id: string, level: CefrLevel): AudioEntry | null {
    const ix = loaded.get(level);
    const e = ix?.files[id];
    if (!ix || !e) return null;
    const credit = e[1] >= 0 && e.length === 3 ? ix.credits[e[1]] : undefined;
    return {
      path: `${level}/${e[0]}`,
      credit: credit && e.length === 3 ? { author: credit[0], license: credit[1], licenseUrl: credit[2], page: commonsPage(e[2]) } : null,
    };
  }

  function url(id: string, level: CefrLevel): Promise<string | null> {
    const key = `${level}/${id}`;
    let p = urls.get(key);
    if (!p) {
      p = (async () => {
        const e = entry(id, level) ?? ((await loadLevel(level)) ? entry(id, level) : null);
        if (!e) return null;
        const blob = await (await fetchFile(e.path)).blob();
        return deps.objectUrl(blob);
      })().catch(() => null);
      void p.then((u) => {
        if (!u) urls.delete(key);
      });
      urls.set(key, p);
    }
    return p;
  }

  /** Every file of every level, with its size (indexes are read, files are not). */
  async function everything(): Promise<{ path: string; bytes: number }[] | null> {
    const m = await manifest();
    if (!m) return null;
    const out: { path: string; bytes: number }[] = [];
    for (const [level, ref] of Object.entries(m.levels) as [CefrLevel, AudioManifest["levels"][CefrLevel]][]) {
      if (!ref) continue;
      out.push({ path: ref.index, bytes: ref.bytes });
      const ix = await loadLevel(level);
      if (!ix) return null;
      const files = Object.values(ix.files);
      // The index lists files, not sizes: spread the level's total evenly for progress.
      const each = files.length ? ref.audioBytes / files.length : 0;
      for (const e of files) out.push({ path: `${level}/${e[0]}`, bytes: each });
    }
    return out;
  }

  async function prune(cache: Cache, keep: ReadonlySet<string>): Promise<void> {
    try {
      for (const req of await cache.keys()) {
        const path = new URL(req.url, "https://local.invalid").pathname;
        if (path !== `${AUDIO_BASE}manifest.json` && !keep.has(path)) await cache.delete(req);
      }
    } catch {
      // housekeeping only
    }
  }

  async function offlineStatus(): Promise<OfflineStatus> {
    const cache = await openCache();
    if (!cache) return { kind: "no-storage" };
    const all = await everything();
    if (!all) return { kind: "unreachable" };
    let stored = 0;
    let total = 0;
    for (const f of all) {
      total += f.bytes;
      if (await cache.match(AUDIO_BASE + f.path).catch(() => undefined)) stored += f.bytes;
    }
    return { kind: "ready", stored: Math.round(stored), total: Math.round(total) };
  }

  async function downloadAll(onProgress: (stored: number, total: number) => void, signal?: AbortSignal): Promise<boolean> {
    const cache = await openCache();
    const all = await everything();
    const m = await manifest();
    if (!cache || !all || !m) return false;
    const total = all.reduce((s, f) => s + f.bytes, 0);
    let stored = 0;
    let ok = true;
    let next = 0;
    const worker = async () => {
      while (ok && next < all.length) {
        const f = all[next++]!;
        if (signal?.aborted) {
          ok = false;
          return;
        }
        try {
          await fetchFile(f.path, signal ? { signal } : undefined);
        } catch {
          ok = false;
          return;
        }
        stored += f.bytes;
        onProgress(Math.round(stored), Math.round(total));
      }
    };
    await Promise.all(Array.from({ length: DOWNLOAD_CONCURRENCY }, worker));
    if (ok) await prune(cache, new Set(pathsOf(m, [...loaded.values()]).map((p) => AUDIO_BASE + p)));
    return ok;
  }

  async function removeOffline(): Promise<void> {
    urls.clear();
    await deps.caches?.delete(AUDIO_CACHE).catch(() => undefined);
  }

  return { manifest, loadLevel, entry, url, offlineStatus, downloadAll, removeOffline };
}

let shared: AudioLibrary | null = null;

/** The browser's audio library (one per page). On the server it is empty. */
export function getAudioLibrary(): AudioLibrary {
  if (shared) return shared;
  if (typeof window === "undefined") return emptyAudio;
  shared = createAudioLibrary({
    fetch: (u, init) => window.fetch(u, init),
    caches: typeof window.caches === "undefined" ? undefined : window.caches,
    objectUrl: (b) => URL.createObjectURL(b),
  });
  return shared;
}

const emptyAudio: AudioLibrary = {
  manifest: async () => null,
  loadLevel: async () => null,
  entry: () => null,
  url: async () => null,
  offlineStatus: async () => ({ kind: "no-storage" }),
  downloadAll: async () => false,
  removeOffline: async () => undefined,
};
