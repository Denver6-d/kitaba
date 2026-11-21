import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AUDIO_BASE, AUDIO_CACHE, createAudioLibrary, type AudioDeps } from "@/features/audio/audio-library";
import { combineOffline, type OfflineSource } from "@/features/library/offline-sources";
import type { OfflineStatus } from "@/features/library/library";
import type { CefrLevel } from "@/domain/model";

/**
 * The pronunciation audio loader (DECISIONS AU9, AU10), run against the real
 * files in public/audio/v1 through a file-backed fetch and an in-memory Cache Storage.
 */

const PUBLIC = new URL("../../public/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("./audio/v1/manifest.json", PUBLIC), "utf8")) as { levels: Partial<Record<CefrLevel, { index: string }>> };
const level = (Object.keys(manifest.levels) as CefrLevel[])[0]!;
const index = JSON.parse(readFileSync(new URL(`./audio/v1/${manifest.levels[level]!.index}`, PUBLIC), "utf8")) as { files: Record<string, [string, number, string?]> };
const ids = Object.keys(index.files);
const humanId = ids.find((id) => index.files[id]![1] >= 0)!;

function fileFetch(log: string[] = [], { offline = false, broken = false } = {}): AudioDeps["fetch"] {
  return async (url) => {
    log.push(url);
    if (offline) throw new TypeError("Failed to fetch");
    if (broken && url.endsWith(".mp3")) return new Response("gone", { status: 404 });
    const path = new URL(`.${url}`, PUBLIC);
    if (!existsSync(path)) return new Response("missing", { status: 404 });
    return new Response(readFileSync(path), { status: 200 });
  };
}

function memoryCaches(): CacheStorage & { stores: Map<string, Map<string, Response>> } {
  const stores = new Map<string, Map<string, Response>>();
  const open = async (name: string) => {
    let s = stores.get(name);
    if (!s) stores.set(name, (s = new Map()));
    const store = s;
    return {
      match: async (url: string) => store.get(url)?.clone(),
      put: async (url: string, res: Response) => void store.set(url, res.clone()),
      keys: async () => [...store.keys()].map((url) => ({ url })),
      delete: async (req: { url: string } | string) => store.delete(typeof req === "string" ? req : req.url),
    } as unknown as Cache;
  };
  return { stores, open, delete: async (name: string) => stores.delete(name), has: async (n: string) => stores.has(n), keys: async () => [...stores.keys()], match: async () => undefined } as unknown as CacheStorage & {
    stores: Map<string, Map<string, Response>>;
  };
}

const objectUrl = (b: Blob) => `blob:test/${b.size}`;

describe("audio loader", () => {
  it("loads only the level it is asked for, and finds a word's file and credit", async () => {
    const log: string[] = [];
    const lib = createAudioLibrary({ fetch: fileFetch(log), objectUrl });
    expect(lib.entry(humanId, level)).toBeNull(); // nothing before the level is loaded
    const ix = await lib.loadLevel(level);
    expect(ix?.level).toBe(level);
    expect(log.filter((u) => u.includes("index-"))).toEqual([AUDIO_BASE + manifest.levels[level]!.index]);
    const e = lib.entry(humanId, level);
    expect(e?.path).toBe(`${level}/${index.files[humanId]![0]}`);
    expect(e?.credit?.author).toBeTruthy();
    expect(e?.credit?.page).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
  });

  it("returns a playable URL and memoises it", async () => {
    const log: string[] = [];
    const lib = createAudioLibrary({ fetch: fileFetch(log), objectUrl });
    const url = await lib.url(humanId, level);
    expect(url).toMatch(/^blob:test\/\d+$/);
    const n = log.length;
    expect(await lib.url(humanId, level)).toBe(url);
    expect(log.length).toBe(n);
  });

  it("resolves to null (Web Speech takes over) for a word without a file, a missing file, or no network", async () => {
    expect(await createAudioLibrary({ fetch: fileFetch(), objectUrl }).url("w-no-such-word", level)).toBeNull();
    expect(await createAudioLibrary({ fetch: fileFetch([], { broken: true }), objectUrl }).url(humanId, level)).toBeNull();
    expect(await createAudioLibrary({ fetch: fileFetch([], { offline: true }), objectUrl }).url(humanId, level)).toBeNull();
  });

  it("does not remember a failure: the file loads once the network is back", async () => {
    let offline = true;
    const lib = createAudioLibrary({ fetch: (u, i) => fileFetch([], { offline })(u, i), objectUrl });
    expect(await lib.url(humanId, level)).toBeNull();
    offline = false;
    expect(await lib.url(humanId, level)).toMatch(/^blob:/);
  });

  it("plays offline from its cache after the network goes away", async () => {
    const caches = memoryCaches();
    let offline = false;
    const deps = { fetch: (u: string, i?: RequestInit) => fileFetch([], { offline })(u, i), caches, objectUrl };
    expect(await createAudioLibrary(deps).url(humanId, level)).toMatch(/^blob:/);
    offline = true;
    expect(await createAudioLibrary(deps).url(humanId, level)).toMatch(/^blob:/);
    expect(caches.stores.has(AUDIO_CACHE)).toBe(true);
  });

  it("downloads everything for offline use and reports it as stored", async () => {
    const caches = memoryCaches();
    const lib = createAudioLibrary({ fetch: fileFetch(), caches, objectUrl });
    const before = await lib.offlineStatus();
    expect(before.kind).toBe("ready");
    let last = 0;
    expect(await lib.downloadAll((stored) => (last = stored))).toBe(true);
    const after = await lib.offlineStatus();
    expect(after.kind === "ready" && after.stored).toBe(after.kind === "ready" && after.total);
    expect(last).toBeGreaterThan(0);
    await lib.removeOffline();
    expect(caches.stores.has(AUDIO_CACHE)).toBe(false);
  });
});

describe("combineOffline", () => {
  const source = (status: OfflineStatus, ok = true): OfflineSource & { got: number } => {
    const s = {
      got: 0,
      offlineStatus: async () => status,
      downloadAll: async (p: (a: number, b: number) => void) => {
        if (status.kind === "ready") p(status.total, status.total);
        s.got++;
        return ok;
      },
      removeOffline: async () => undefined,
    };
    return s;
  };

  it("adds the audio to the library's size and progress", async () => {
    const words = source({ kind: "ready", stored: 0, total: 100 });
    const audio = source({ kind: "ready", stored: 10, total: 50 });
    const both = combineOffline(words, audio);
    expect(await both.offlineStatus()).toEqual({ kind: "ready", stored: 10, total: 150 });
    const seen: number[] = [];
    expect(await both.downloadAll((s, t) => seen.push(s / t))).toBe(true);
    expect(seen.at(-1)).toBe(1);
  });

  it("never lets unreachable audio block the words", async () => {
    const words = source({ kind: "ready", stored: 0, total: 100 });
    const audio = source({ kind: "unreachable" });
    const both = combineOffline(words, audio);
    expect(await both.offlineStatus()).toEqual({ kind: "ready", stored: 0, total: 100 });
    expect(await both.downloadAll(() => undefined)).toBe(true);
    expect(audio.got).toBe(0);
  });

  it("follows the library when the library itself is unavailable", async () => {
    const both = combineOffline(source({ kind: "no-storage" }), source({ kind: "ready", stored: 0, total: 5 }));
    expect(await both.offlineStatus()).toEqual({ kind: "no-storage" });
    expect(await both.downloadAll(() => undefined)).toBe(false);
  });
});
