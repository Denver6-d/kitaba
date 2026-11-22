/**
 * Content-Security-Policy for every page (DECISIONS SEC1).
 *
 * Two policies apply to a page, and the browser enforces both:
 * 1. This header policy (next.config.ts). It allows inline scripts only as a
 *    fallback, so a page rendered at request time (dev, an uncached 404) still works.
 * 2. A <meta> policy that `scripts/csp-hashes.mjs` writes into every prerendered
 *    page after `next build`, listing the SHA-256 hash of each inline script on
 *    that page. Every page of this app is prerendered, so in production only
 *    those exact inline scripts run (no 'unsafe-inline' in effect).
 *
 * Nonces were rejected: Next.js adds a nonce only to pages rendered per request,
 * which would end static prerendering (Cache Components) for the whole app.
 */

/** Origins the browser may contact for the Supabase project (REST, auth and realtime), or none when not configured. */
export function supabaseOrigins(url: string | undefined): string[] {
  if (!url) return [];
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return [];
  }
  const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
  if (u.protocol === "https:") return [u.origin, `wss://${u.host}`];
  if (u.protocol === "http:" && local) return [u.origin, `ws://${u.host}`];
  return [];
}

export function contentSecurityPolicy({ supabaseUrl, dev }: { supabaseUrl: string | undefined; dev: boolean }): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // 'unsafe-inline' is narrowed to hashed scripts by the per-page <meta> policy; React needs 'unsafe-eval' in dev only.
    "script-src": ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : [])],
    // React style attributes and the motion library set inline styles.
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    // next/font self-hosts the fonts at build time.
    "font-src": ["'self'"],
    // Pronunciation files play from Cache Storage through blob: URLs.
    "media-src": ["'self'", "blob:"],
    "connect-src": ["'self'", ...supabaseOrigins(supabaseUrl)],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  return Object.entries(directives)
    .map(([k, v]) => `${k} ${v.join(" ")}`)
    .join("; ");
}

/** The per-page <meta> policy: only same-origin script files and the inline scripts with these hashes. */
export function metaScriptPolicy(hashes: readonly string[]): string {
  return ["script-src", "'self'", ...hashes].join(" ");
}
