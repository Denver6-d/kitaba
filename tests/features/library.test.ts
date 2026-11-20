import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { libraryWordId, wordsFromChunk } from "@/data/library";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { tatoebaUrl } from "@/data/play-word";
import { buildSession, wordFromId } from "@/features/games/build-session";
import { TatoebaCreditLine } from "@/features/library/credit-line";
import { loadSupabase } from "@/lib/supabase/client";
import { CONTENT_BASE, CONTENT_CACHE, createLibrary, withTimeout, type Library, type LibraryDeps } from "@/features/library/library";
import { buildItem } from "@/domain/games/items";
import { ALL_STAGE_IDS } from "@/domain/games/campaign";
import { hintFor } from "@/domain/spelling/hint";
import { sameLevels } from "@/domain/model";
import { seededRng } from "@/domain/shared/random";
import { newCard } from "@/domain/spelling/srs";
import { createMemoryOutbox } from "@/repositories/local/outbox";
import { createMemoryStore } from "@/repositories/store";
import { createRepositories } from "@/repositories/create";

/**
 * The on-demand library loader (DECISIONS OD13), run against the real files in
 * public/content/v1 through a file-backed fetch and an in-memory Cache Storage.
 */

const PUBLIC = new URL("../../public/", import.meta.url);

function fileFetch(log: string[] = [], { offline = false } = {}): LibraryDeps["fetch"] {
  return async (url) => {
    log.push(url);
    if (offline) throw new TypeError("Failed to fetch");
    const path = new URL(`.${url}`, PUBLIC);
    if (!existsSync(path)) return new Response("missing", { status: 404 });
    return new Response(readFileSync(path), { status: 200, headers: { "content-type": url.endsWith(".tsv") ? "text/tab-separated-values" : "application/json" } });
  };
}

/** Enough of CacheStorage for the loader: open, match, put, delete. */
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

describe("library loader", () => {
  it("loads one level's words on demand, validated, with examples and credits", async () => {
    const log: string[] = [];
    const lib = createLibrary({ fetch: fileFetch(log) });
    const words = await lib.wordsAt("B1");
    expect(words.length).toBeGreaterThan(1000);
    expect(words.every((w) => w.level === "B1" && w.library)).toBe(true);
    expect(log.some((u) => u.includes("words-B1-"))).toBe(true);
    expect(log.some((u) => u.includes("words-C1-") || u.includes("sentences-"))).toBe(false);
    const credited = words.find((w) => w.exampleCredit);
    expect(credited?.example).toBeTruthy();
    expect(credited?.exampleCredit?.author).toBeTruthy();
  });

  it("memoises: a second call makes no new request", async () => {
    const log: string[] = [];
    const lib = createLibrary({ fetch: fileFetch(log) });
    await lib.wordsAt("A2");
    const n = log.length;
    await lib.wordsAt("A2");
    expect(log.length).toBe(n);
  });

  it("works offline from the content cache after a download, and reports progress in bytes", async () => {
    const caches = memoryCaches();
    const online = createLibrary({ fetch: fileFetch(), caches });
    const progress: number[] = [];
    expect(await online.downloadAll((stored) => progress.push(stored))).toBe(true);
    const status = await online.offlineStatus();
    if (status.kind !== "ready") throw new Error(status.kind);
    expect(status.stored === status.total && status.total > 0).toBe(true);
    expect(progress.at(-1)).toBe(status.total);
    // Games never need the credits list, so the offline copy leaves it out.
    expect([...(caches.stores.get(CONTENT_CACHE)?.keys() ?? [])].some((k) => k.includes("tatoeba-credits"))).toBe(false);
    expect(caches.stores.get(CONTENT_CACHE)?.has(`${CONTENT_BASE}manifest.json`)).toBe(true);

    const offline = createLibrary({ fetch: fileFetch([], { offline: true }), caches });
    expect((await offline.wordsAt("C1")).length).toBeGreaterThan(1000);
    expect((await offline.sentencesAt("A1")).length).toBeGreaterThan(1000);
  });

  it("resolves to nothing, not an error, when offline with nothing stored", async () => {
    const lib = createLibrary({ fetch: fileFetch([], { offline: true }), caches: memoryCaches() });
    expect(await lib.manifest()).toBeNull();
    expect(await lib.wordsAt("B1")).toEqual([]);
    expect(await lib.sentencesAt("B1")).toEqual([]);
  });

  it("finds words by id nearest the given level first", async () => {
    const lib = createLibrary({ fetch: fileFetch() });
    const [c1] = await lib.wordsAt("C1");
    const [a2] = await lib.wordsAt("A2");
    const found = await lib.findWords([c1!.id, a2!.id, "w-not-a-word-at-all"], "C1");
    expect(found.get(c1!.id)?.word).toBe(c1!.word);
    expect(found.get(a2!.id)?.word).toBe(a2!.word);
    expect(found.has("w-not-a-word-at-all")).toBe(false);
  });

  it("gives every library sentence its Tatoeba credit, and Arabic translations theirs", async () => {
    const lib = createLibrary({ fetch: fileFetch() });
    const s = await lib.sentencesAt("A1");
    expect(s.every((x) => /^t\d+$/.test(x.id) && x.credit.author.length > 0)).toBe(true);
    const withAr = s.find((x) => x.ar);
    expect(withAr?.ar?.credit.author).toBeTruthy();
  });
});

describe("wordsFromChunk", () => {
  it("builds PlayWords with the bank's id scheme and optional fields", () => {
    const words = wordsFromChunk({
      level: "B1",
      authors: ["CK"],
      examples: { t5: ["The knight rode home.", 0], o1: ["What colour is it?", -1] },
      words: { homophones: [["knight", 3000, { c: ["night"], ex: "t5", ar: "فارس" }]], "british-american": [["color", 3001, { uk: "colour", ex: "o1" }]], common: [["plain", 3002]] },
    });
    expect(words[0]).toMatchObject({ id: "w-knight", ar: "فارس", confusables: ["night"], example: "The knight rode home.", exampleCredit: { id: 5, author: "CK" } });
    expect(words[1]).toMatchObject({ id: "w-color", uk: "colour", example: "What colour is it?" });
    expect(words[1]?.exampleCredit).toBeUndefined();
    expect(words[2]).toEqual({ id: "w-plain", word: "plain", level: "B1", category: "common", library: true });
    expect(libraryWordId("well-known")).toBe("w-well-known");
  });
});

describe("items without an example (library words)", () => {
  const ctx = { accent: "us" as const, rng: seededRng(1), bankSpellings: new Set<string>() };
  const bare = { id: "w-knight", word: "knight", category: "homophones", confusables: ["night"] };
  it("skips modes that need one, and never speaks a homophone alone", () => {
    expect(buildItem("listen", bare, ctx, "k")).toBeNull();
    expect(buildItem("fix", { ...bare, category: "common" }, ctx, "k")).toBeNull();
    expect(buildItem("sentence", { ...bare, category: "common" }, ctx, "k")).toBeNull();
    expect(buildItem("listen", { ...bare, category: "common" }, ctx, "k")?.kind).toBe("typed");
    expect(buildItem("scramble", { ...bare, category: "common" }, ctx, "k")?.kind).toBe("typed");
  });
});

describe("buildSession with the library", () => {
  const NOW = Date.UTC(2026, 10, 20, 12);
  async function deps(library: Library, level: "B1" | "B2" | "C1" = "C1") {
    const repos = createRepositories({ store: createMemoryStore(), now: () => NOW, newId: () => "id" });
    await repos.profile.save({ levels: sameLevels(level), levelSource: "choice", levelsAt: NOW });
    return { repos, meta: createMemoryOutbox(), accent: "us" as const, rng: seededRng(7), now: NOW, library };
  }

  it("plays library words at the learner's level, and returns every word it uses", async () => {
    const lib = createLibrary({ fetch: fileFetch() });
    // B1 library words all have an Arabic hint (DECISIONS M4), so they play beside the bank's.
    const s = await buildSession({ kind: "free", mode: "listen", level: null, category: null }, await deps(lib, "B1"));
    expect(s.items.length).toBe(10);
    for (const i of s.items) expect(s.words.get(i.wordId), i.wordId).toBeDefined();
    const seen = new Set<boolean>();
    for (let round = 0; round < 6; round += 1) {
      const r = await buildSession({ kind: "free", mode: "listen", level: null, category: null }, { ...(await deps(lib, "B1")), rng: seededRng(round + 11) });
      for (const w of r.words.values()) seen.add(Boolean(w.library));
    }
    expect(seen.has(true)).toBe(true);
  });

  it("plays only words with a hint, at every level and in every kind of game (DECISIONS M4)", async () => {
    const lib = createLibrary({ fetch: fileFetch() });
    const requests = [
      ...ALL_STAGE_IDS.map((id) => ({ kind: "stage", id }) as const),
      { kind: "daily" } as const,
      { kind: "free", mode: "missing", level: null, category: null } as const,
      { kind: "free", mode: "choice", level: null, category: "ie-ei" } as const,
    ];
    for (const level of ["B1", "B2", "C1"] as const) {
      const d = await deps(lib, level);
      for (const req of requests) {
        const s = await buildSession(req, d);
        expect(s.items.length, `${JSON.stringify(req)} at ${level}`).toBeGreaterThan(0);
        for (const w of s.words.values()) expect(hintFor(w), `${w.word} (${JSON.stringify(req)} at ${level})`).not.toBeNull();
      }
    }
  }, 120_000);

  it("still starts a game from the bundled bank when the library cannot load", async () => {
    const lib = createLibrary({ fetch: fileFetch([], { offline: true }) });
    const s = await buildSession({ kind: "stage", id: "w1-s1" }, await deps(lib, "B2"));
    expect(s.items.length).toBeGreaterThan(0);
    expect([...s.words.values()].every((w) => !w.library)).toBe(true);
  });

  it("reviews a missed library word by its id", async () => {
    const lib = createLibrary({ fetch: fileFetch() });
    const d = await deps(lib);
    const [w] = await lib.wordsAt("C1");
    await d.repos.words.saveCard({ ...newCard(w!.id, NOW - 10 * 86_400_000), due: NOW - 1000 });
    const s = await buildSession({ kind: "review" }, d);
    expect(s.items.map((i) => i.wordId)).toContain(w!.id);
    expect(s.words.get(w!.id)?.word).toBe(w!.word);
    expect(s.extraWords?.has(w!.id)).toBe(false);
  });
});

describe("library loader: failures, retries and housekeeping (review fixes)", () => {
  const realManifest = () => JSON.parse(readFileSync(new URL("./content/v1/manifest.json", PUBLIC), "utf8")) as { files: Record<string, { path: string }> };

  it("does not remember an unreachable library: the same level loads once the network is back", async () => {
    const net = { online: false };
    const real = fileFetch();
    const lib = createLibrary({ fetch: async (url, init) => (net.online ? real(url, init) : Promise.reject(new TypeError("offline"))) });
    expect(await lib.wordsAt("B1")).toEqual([]);
    expect(await lib.sentencesAt("B1")).toEqual([]);
    net.online = true;
    expect((await lib.wordsAt("B1")).length).toBeGreaterThan(1000);
    expect((await lib.sentencesAt("B1")).length).toBeGreaterThan(1000);
  });

  it("reads the manifest again when a tab asks for a file a content deploy removed", async () => {
    const real = fileFetch();
    let manifests = 0;
    const lib = createLibrary({
      fetch: async (url, init) => {
        if (url.endsWith("manifest.json") && manifests++ === 0) {
          const old = realManifest();
          old.files["words-B1-1"]!.path = "words-B1-1.0000000000.json";
          return new Response(JSON.stringify(old), { status: 200 });
        }
        return real(url, init);
      },
    });
    expect((await lib.wordsAt("B1")).length).toBeGreaterThan(1000);
    expect(manifests).toBe(2);
  });

  it("removes stored files that the current manifest no longer lists", async () => {
    const caches = memoryCaches();
    const store = await caches.open(CONTENT_CACHE);
    await store.put(`${CONTENT_BASE}words-A1-1.0000000000.json`, new Response("old"));
    const lib = createLibrary({ fetch: fileFetch(), caches });
    await lib.manifest();
    await new Promise((r) => setTimeout(r, 20));
    expect(caches.stores.get(CONTENT_CACHE)?.has(`${CONTENT_BASE}words-A1-1.0000000000.json`)).toBe(false);
    expect(caches.stores.get(CONTENT_CACHE)?.has(`${CONTENT_BASE}manifest.json`)).toBe(true);
  });

  it("finds ids at the first level that has them all, without loading the others", async () => {
    const log: string[] = [];
    const lib = createLibrary({ fetch: fileFetch(log) });
    const [w] = await createLibrary({ fetch: fileFetch() }).wordsAt("C1");
    await lib.findWords([w!.id], "C1");
    const words = log.filter((u) => u.includes("/words-"));
    expect(words.length).toBeGreaterThan(0);
    expect(words.every((u) => u.includes("words-C1-"))).toBe(true);
  });

  it("stops a download on a failed file, keeps what was stored, and reports it as partial", async () => {
    const caches = memoryCaches();
    const real = fileFetch();
    let files = 0;
    const lib = createLibrary({ caches, fetch: async (url, init) => (url.endsWith("manifest.json") || files++ < 3 ? real(url, init) : Promise.reject(new TypeError("dropped"))) });
    expect(await lib.downloadAll(() => undefined)).toBe(false);
    const s = await lib.offlineStatus();
    if (s.kind !== "ready") throw new Error(s.kind);
    expect(s.stored).toBeGreaterThan(0);
    expect(s.stored).toBeLessThan(s.total);
  });

  it("stops at once when aborted, and can remove the stored copy", async () => {
    const caches = memoryCaches();
    const log: string[] = [];
    const lib = createLibrary({ caches, fetch: fileFetch(log) });
    const ctrl = new AbortController();
    expect(await lib.downloadAll(() => ctrl.abort(), ctrl.signal)).toBe(false);
    expect(log.filter((u) => !u.endsWith("manifest.json")).length).toBe(1);
    await lib.removeOffline();
    const s = await lib.offlineStatus();
    expect(s.kind === "ready" && s.stored === 0).toBe(true);
  });

  it("tells 'no storage' apart from 'unreachable'", async () => {
    expect((await createLibrary({ fetch: fileFetch() }).offlineStatus()).kind).toBe("no-storage");
    expect((await createLibrary({ fetch: fileFetch([], { offline: true }), caches: memoryCaches() }).offlineStatus()).kind).toBe("unreachable");
  });

  it("withTimeout falls back when the work stalls or fails", async () => {
    expect(await withTimeout(new Promise<number>(() => undefined), 10, -1)).toBe(-1);
    expect(await withTimeout(Promise.reject(new Error("x")), 1000, -2)).toBe(-2);
    expect(await withTimeout(Promise.resolve(3), 1000, -3)).toBe(3);
  });
});

describe("sessions that must not depend on the library (review fixes)", () => {
  const NOW = Date.UTC(2026, 10, 20, 12);
  async function deps(library: Library) {
    const repos = createRepositories({ store: createMemoryStore(), now: () => NOW, newId: () => "id" });
    await repos.profile.save({ levels: sameLevels("B1"), levelSource: "choice", levelsAt: NOW });
    return { repos, meta: createMemoryOutbox(), accent: "us" as const, rng: seededRng(3), now: NOW, library };
  }

  it("gives the same daily challenge whether or not the library loads", async () => {
    const online = await buildSession({ kind: "daily" }, await deps(createLibrary({ fetch: fileFetch() })));
    const offline = await buildSession({ kind: "daily" }, await deps(createLibrary({ fetch: fileFetch([], { offline: true }) })));
    expect(online.items.map((i) => i.wordId)).toEqual(offline.items.map((i) => i.wordId));
    expect(online.items.length).toBeGreaterThan(0);
  });

  it("still reviews a due library word when the library cannot load", async () => {
    const d = await deps(createLibrary({ fetch: fileFetch([], { offline: true }) }));
    await d.repos.words.saveCard({ ...newCard("w-exhale", NOW - 10 * 86_400_000), due: NOW - 1000 });
    const s = await buildSession({ kind: "review" }, d);
    expect(s.items.map((i) => i.wordId)).toEqual(["w-exhale"]);
    expect(s.words.get("w-exhale")?.word).toBe("exhale");
    expect(wordFromId("w-well-known")?.word).toBe("well-known");
    expect(wordFromId("x-teh")).toBeNull();
  });
});

describe("attribution", () => {
  it("links each Tatoeba sentence and names its author and the licence", () => {
    expect(tatoebaUrl(1276)).toBe("https://tatoeba.org/sentences/show/1276");
    const html = renderToStaticMarkup(createElement(TatoebaCreditLine, { credit: { id: 1276, author: "CK" } })).replaceAll("<!-- -->", "");
    expect(html).toContain('href="https://tatoeba.org/sentences/show/1276"');
    expect(html).toContain("Tatoeba #1276 · CK");
    expect(html).toContain('href="/credits"');
    expect(html).toContain("CC BY 2.0 FR");
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("loads no account library when accounts are not configured", async () => {
    expect(await loadSupabase()).toBeNull();
  });
});
