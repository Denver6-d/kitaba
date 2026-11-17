/**
 * Only same-site relative paths may be used as a post-login destination (no open redirect).
 * Control characters are rejected outright: the URL parser strips tabs and newlines,
 * so "/<TAB>/evil.com" would otherwise become "//evil.com". A colon in the first
 * segment ("/javascript:…") is refused as defence in depth.
 */
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

export function safeNext(raw: string | null | undefined, fallback = "/account"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || CONTROL_CHARS.test(raw) || /^\/[^/]*:/.test(raw)) return fallback;
  try {
    const base = "https://kitaba.invalid";
    const u = new URL(raw, base);
    if (u.origin !== base) return fallback;
    // Dot segments are resolved by the parser ("/.//evil.com" becomes "//evil.com"), so the
    // normalised path is checked again: a leading "//" would be a protocol-relative URL.
    if (u.pathname.startsWith("//") || u.pathname.includes("\\")) return fallback;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return fallback;
  }
}
