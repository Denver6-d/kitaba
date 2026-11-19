import { chunkKeys, sentencesFromChunk, wordsFromChunk } from "@/data/library";
import { manifestSchema, sentenceChunkSchema, wordChunkSchema, type Manifest } from "@/data/library-schema";
import type { LibrarySentence, PlayWord } from "@/data/play-word";
import type { CefrLevel } from "@/domain/model";
import { levelsByDistance } from "@/domain/levels/pool";

/**
 * The open-data library, loaded on demand (DECISIONS OD13).
 *
 * - The manifest is fetched network-first, so a deploy with new content is
 *   seen at once; offline, the cached copy is used.
 * - Data files have content hashes in their names, so they are cache-first and
 *   kept in one Cache Storage cache shared with the service worker. Nothing is
 *   ever sent anywhere: these are plain GETs of the site's own static files.
 * - Every file is validated with zod (external input) and memoised in memory.
 * - Any failure (offline before the first download, storage blocked) resolves
 *   to "no library words", so every game still works with the bundled bank.
 */

export const CONTENT_BASE = "/content/v1/";
/** Also named in public/sw.js; never deleted on a service-worker update. */
export const CONTENT_CACHE = "kitaba-content-v1";

/** How long a game waits for the library before it starts from the bundled bank. */
export const LIBRARY_WAIT_MS = 4000;

/** Resolves to the promise's value, or to `fallback` after `ms` or on an error. The work itself goes on (and is memoised when it succeeds). */
export function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

/** Files games need offline; the credits list is a download for people, not for play. */
const isPlayData = (key: string) => key.startsWith("words-") || key.startsWith("sentences-");

export type OfflineStatus = { readonly kind: "ready"; readonly stored: number; readonly total: number } | { readonly kind: "no-storage" } | { readonly kind: "unreachable" };

export interface LibraryDeps {
  readonly fetch: (url: string, init?: RequestInit) => Promise<Response>;
  /** Cache Storage, when the browser offers it (not in some private modes). */
  readonly caches?: CacheStorage | undefined;
}

export interface Library {
  manifest(): Promise<Manifest | null>;
  /** Library words at one level (all its parts); [] when unavailable. */
  wordsAt(level: CefrLevel): Promise<PlayWord[]>;
  /** Library dictation sentences at one level; [] when unavailable. */
  sentencesAt(level: CefrLevel): Promise<LibrarySentence[]>;
  /** Finds library words by id, loading levels nearest to `near` first and stopping when all are found. */
  findWords(ids: readonly string[], near: CefrLevel): Promise<Map<string, PlayWord>>;
  /** Bytes of the play data already stored for offline use and the total; or why that is unknown. */
  offlineStatus(): Promise<OfflineStatus>;
  /** Stores every file for offline use; reports progress in bytes. */
  downloadAll(onProgress: (stored: number, total: number) => void, signal?: AbortSignal): Promise<boolean>;
  /** Removes the stored copy (the files are fetched again when needed). */
  removeOffline(): Promise<void>;
}

export function createLibrary(deps: LibraryDeps): Library {
  let manifestP: Promise<Manifest | null> | null = null;
  const files = new Map<string, Promise<unknown>>();
  const wordsByLevel = new Map<CefrLevel, Promise<PlayWord[]>>();
  const sentencesByLevel = new Map<CefrLevel, Promise<LibrarySentence[]>>();

  const openCache = async (): Promise<Cache | null> => {
    try {
      return deps.caches ? await deps.caches.open(CONTENT_CACHE) : null;
    } catch {
      return null;
    }
  };

  async function readManifest(): Promise<Manifest | null> {
    const url = `${CONTENT_BASE}manifest.json`;
    const cache = await openCache();
    try {
      const res = await deps.fetch(url, { cache: "no-cache" });
      if (!res.ok) throw new Error(String(res.status));
      if (cache) await cache.put(url, res.clone()).catch(() => undefined);
      const m = manifestSchema.parse(await res.json());
      if (cache) void prune(cache, m);
      return m;
    } catch {
      const hit = await cache?.match(url).catch(() => undefined);
      if (!hit) return null;
      try {
        return manifestSchema.parse(await hit.json());
      } catch {
        return null;
      }
    }
  }

  /** Drops stored files that the current manifest no longer lists (an older content version). */
  async function prune(cache: Cache, m: Manifest): Promise<void> {
    try {
      const keep = new Set([`${CONTENT_BASE}manifest.json`, ...Object.values(m.files).map((f) => CONTENT_BASE + f.path)]);
      for (const req of await cache.keys()) {
        const path = new URL(req.url, "https://local.invalid").pathname;
        if (!keep.has(path)) await cache.delete(req);
      }
    } catch {
      // Pruning is housekeeping: never let it break loading.
    }
  }

  function manifest(): Promise<Manifest | null> {
    manifestP ??= readManifest().then((m) => {
      // Retry later instead of remembering a failure for the whole visit.
      if (!m) manifestP = null;
      return m;
    });
    return manifestP;
  }

  async function fetchFile(path: string): Promise<Response> {
    const url = CONTENT_BASE + path;
    const cache = await openCache();
    const hit = await cache?.match(url).catch(() => undefined);
    if (hit) return hit;
    const res = await deps.fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    if (cache) await cache.put(url, res.clone()).catch(() => undefined);
    return res;
  }

  function file(path: string): Promise<unknown> {
    let p = files.get(path);
    if (!p) {
      p = fetchFile(path).then((r) => r.json() as Promise<unknown>);
      p.catch(() => files.delete(path));
      files.set(path, p);
    }
    return p;
  }

  async function parts<T>(kind: "words" | "sentences", level: CefrLevel, parse: (raw: unknown) => T[], fresh = false): Promise<T[]> {
    if (fresh) manifestP = null;
    const m = await manifest();
    // Throw (not []) so the level is not remembered as empty: the next call retries.
    if (!m) throw new Error("library unavailable");
    const keys = chunkKeys(m.files, kind, level);
    try {
      const chunks = await Promise.all(keys.map((k) => file(m.files[k]!.path).then(parse)));
      return chunks.flat();
    } catch (e) {
      // A tab open across a content deploy asks for files that are gone: read the manifest again, once.
      if (fresh) throw e;
      return parts(kind, level, parse, true);
    }
  }

  function wordsAt(level: CefrLevel): Promise<PlayWord[]> {
    let p = wordsByLevel.get(level);
    if (!p) {
      p = parts("words", level, (raw) => wordsFromChunk(wordChunkSchema.parse(raw))).catch(() => {
        wordsByLevel.delete(level);
        return [];
      });
      wordsByLevel.set(level, p);
    }
    return p;
  }

  function sentencesAt(level: CefrLevel): Promise<LibrarySentence[]> {
    let p = sentencesByLevel.get(level);
    if (!p) {
      p = parts("sentences", level, (raw) => sentencesFromChunk(sentenceChunkSchema.parse(raw))).catch(() => {
        sentencesByLevel.delete(level);
        return [];
      });
      sentencesByLevel.set(level, p);
    }
    return p;
  }

  async function findWords(ids: readonly string[], near: CefrLevel): Promise<Map<string, PlayWord>> {
    const want = new Set(ids);
    const found = new Map<string, PlayWord>();
    if (want.size === 0) return found;
    for (const level of levelsByDistance(near)) {
      for (const w of await wordsAt(level)) if (want.has(w.id)) found.set(w.id, w);
      if (found.size === want.size) break;
    }
    return found;
  }

  async function offlineStatus(): Promise<OfflineStatus> {
    const cache = await openCache();
    if (!cache) return { kind: "no-storage" };
    const m = await manifest();
    if (!m) return { kind: "unreachable" };
    let stored = 0;
    let total = 0;
    for (const [key, f] of Object.entries(m.files)) {
      if (!isPlayData(key)) continue;
      total += f.bytes;
      if (await cache.match(CONTENT_BASE + f.path).catch(() => undefined)) stored += f.bytes;
    }
    return { kind: "ready", stored, total };
  }

  async function downloadAll(onProgress: (stored: number, total: number) => void, signal?: AbortSignal): Promise<boolean> {
    const m = await manifest();
    const cache = await openCache();
    if (!m || !cache) return false;
    const list = Object.entries(m.files).flatMap(([key, f]) => (isPlayData(key) ? [f] : []));
    const total = list.reduce((s, f) => s + f.bytes, 0);
    let stored = 0;
    for (const f of list) {
      if (signal?.aborted) return false;
      const url = CONTENT_BASE + f.path;
      if (!(await cache.match(url).catch(() => undefined))) {
        try {
          const res = await deps.fetch(url, signal ? { signal } : undefined);
          if (!res.ok) return false;
          await cache.put(url, res);
        } catch {
          return false;
        }
      }
      stored += f.bytes;
      onProgress(stored, total);
    }
    return true;
  }

  async function removeOffline(): Promise<void> {
    files.clear();
    await deps.caches?.delete(CONTENT_CACHE).catch(() => undefined);
  }

  return { manifest, wordsAt, sentencesAt, findWords, offlineStatus, downloadAll, removeOffline };
}

let shared: Library | null = null;

/** The browser's library (one per page). On the server it is empty. */
export function getLibrary(): Library {
  if (shared) return shared;
  if (typeof window === "undefined") return emptyLibrary;
  shared = createLibrary({
    fetch: (url, init) => window.fetch(url, init),
    caches: typeof window.caches === "undefined" ? undefined : window.caches,
  });
  return shared;
}

const emptyLibrary: Library = {
  manifest: async () => null,
  wordsAt: async () => [],
  sentencesAt: async () => [],
  findWords: async () => new Map(),
  offlineStatus: async () => ({ kind: "no-storage" }),
  downloadAll: async () => false,
  removeOffline: async () => undefined,
};

