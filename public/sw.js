/*
 * Service worker (hand-written, no library).
 * Goal: installable app that works offline in guest mode.
 * - Same-origin GET requests only. Cross-origin requests (Supabase) are never
 *   intercepted or cached.
 * - Pages: network first, falling back to the cache, then to /offline.
 * - Hashed build assets (/_next/static): cache first (they never change).
 * - Other same-origin assets (icons, manifest): stale-while-revalidate.
 * - Open-data library (/content/v1/): its own cache, kept across deploys. Data
 *   files have content hashes in their names, so they are cache-first; the
 *   manifest is network-first. The page shares this cache (features/library).
 * - Pronunciation audio (/audio/v1/): the same rules in a second long-lived
 *   cache, shared with features/audio. Kept separate because the library prunes
 *   its cache down to the files its own manifest lists.
 */
// The registration URL carries the build stamp (?v=...), so every deploy gets a
// fresh cache and the activate step deletes the previous ones.
const VERSION = `kitaba-${new URL(self.location.href).searchParams.get("v") || "dev"}`;
const PAGES = ["/", "/play", "/play/game", "/welcome", "/write", "/write/free", "/write/dictation", "/review", "/progress", "/leaderboard", "/settings", "/privacy", "/credits", "/account", "/offline"];
/** Same name as CONTENT_CACHE in src/features/library/library.ts. */
const CONTENT_CACHE = "kitaba-content-v1";
const CONTENT_PREFIX = "/content/v1/";
/** Same name as AUDIO_CACHE in src/features/audio/audio-library.ts. */
const AUDIO_CACHE = "kitaba-audio-v1";
const AUDIO_PREFIX = "/audio/v1/";
const LONG_LIVED = [CONTENT_CACHE, AUDIO_CACHE];
const STATIC_RE = /\/_next\/static\/[^"'\s)]+/g;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      const assets = new Set(["/icon.svg", "/icon-192.png", "/manifest.webmanifest"]);
      for (const page of PAGES) {
        try {
          const res = await fetch(page, { credentials: "same-origin" });
          if (!res.ok) continue;
          const html = await res.clone().text();
          await cache.put(page, res);
          // Precache the scripts and styles each page needs, so it is interactive offline.
          for (const m of html.matchAll(STATIC_RE)) assets.add(m[0].replace(/\\u0026/g, "&"));
        } catch {
          // Offline during install: skip; the page is cached on first visit instead.
        }
      }
      await Promise.all(
        [...assets].map((url) =>
          cache.add(url).catch(() => {
            /* ignore missing assets */
          }),
        ),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      // The content cache outlives deploys: its files are addressed by hash and still valid.
      await Promise.all(keys.filter((k) => k !== VERSION && !LONG_LIVED.includes(k)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch Supabase or anything external
  if (url.pathname.startsWith("/auth/")) return; // auth callbacks must always hit the network

  if (url.pathname.startsWith(CONTENT_PREFIX)) {
    event.respondWith(url.pathname === `${CONTENT_PREFIX}manifest.json` ? networkFirstContent(req, CONTENT_CACHE) : cacheFirstContent(req, CONTENT_CACHE));
    return;
  }
  if (url.pathname.startsWith(AUDIO_PREFIX)) {
    event.respondWith(url.pathname === `${AUDIO_PREFIX}manifest.json` ? networkFirstContent(req, AUDIO_CACHE) : cacheFirstContent(req, AUDIO_CACHE));
    return;
  }
  if (req.mode === "navigate") {
    event.respondWith(networkFirstPage(req));
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req));
    return;
  }
  if (req.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) return; // let the router fall back to a full navigation
  event.respondWith(staleWhileRevalidate(req, event));
});

async function networkFirstPage(req) {
  const cache = await caches.open(VERSION);
  const url = new URL(req.url);
  try {
    const res = await fetch(req);
    if (res.ok && res.type === "basic") await cache.put(url.pathname, res.clone());
    return res;
  } catch {
    return (await cache.match(url.pathname)) || (await cache.match("/offline")) || Response.error();
  }
}

async function cacheFirstContent(req, name) {
  const cache = await caches.open(name);
  const url = new URL(req.url).pathname;
  const hit = await cache.match(url);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.type === "basic") await cache.put(url, res.clone());
  return res;
}

async function networkFirstContent(req, name) {
  const cache = await caches.open(name);
  const url = new URL(req.url).pathname;
  try {
    const res = await fetch(req);
    if (res.ok && res.type === "basic") await cache.put(url, res.clone());
    return res;
  } catch {
    return (await cache.match(url)) || Response.error();
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) await cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req, event) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  const update = fetch(req)
    .then(async (res) => {
      if (res.ok && res.type === "basic") await cache.put(req, res.clone());
      return res;
    })
    .catch(() => hit || Response.error());
  if (hit) {
    event.waitUntil(update);
    return hit;
  }
  return update;
}
