/*
 * Kitaba service worker (hand-written, no library).
 * Goal: installable app that works offline in guest mode.
 * - Same-origin GET requests only. Cross-origin requests (Supabase) are never
 *   intercepted or cached.
 * - Pages: network first, falling back to the cache, then to /offline.
 * - Hashed build assets (/_next/static): cache first (they never change).
 * - Other same-origin assets (icons, manifest): stale-while-revalidate.
 */
const VERSION = "kitaba-v1";
const PAGES = [
  "/",
  "/practice",
  "/learn",
  "/learn/drill",
  "/custom",
  "/diagnostic",
  "/spelling",
  "/spelling/review",
  "/sentences",
  "/professional",
  "/stats",
  "/achievements",
  "/certificate",
  "/settings",
  "/privacy",
  "/account",
  "/leaderboard",
  "/offline",
];
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
      await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
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
