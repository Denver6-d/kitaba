/** Only same-site relative paths may be used as a post-login destination (no open redirect). */
export function safeNext(raw: string | null | undefined, fallback = "/account"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || /^\/[^/]*:/.test(raw)) return fallback;
  return raw;
}
