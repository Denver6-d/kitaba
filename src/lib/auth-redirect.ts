import { safeNext } from "./safe-next";

/**
 * OAuth and email-link redirects (DECISIONS O1). The app only ever sends
 * Supabase back to its own origin's /auth/callback, with a `next` path that
 * passed safeNext, so a crafted link can never bounce a signed-in user to
 * another site. Supabase must also list that exact URL as an allowed redirect.
 */

/** Providers offered in the UI. Apple is not offered (it needs a paid developer account). */
export const OAUTH_PROVIDERS = ["google", "github"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export const PROVIDER_LABELS: Readonly<Record<OAuthProvider, string>> = { google: "Google", github: "GitHub" };

export const isOAuthProvider = (v: unknown): v is OAuthProvider => typeof v === "string" && (OAUTH_PROVIDERS as readonly string[]).includes(v);

/** The callback URL for this site; null when the origin is not a plain http(s) origin. */
export function callbackUrl(origin: string, next: string | null = "/account"): string | null {
  let o: URL;
  try {
    o = new URL(origin);
  } catch {
    return null;
  }
  if ((o.protocol !== "https:" && o.protocol !== "http:") || o.origin !== origin.replace(/\/$/, "")) return null;
  const u = new URL("/auth/callback", o.origin);
  u.searchParams.set("next", safeNext(next));
  return u.toString();
}

export type CallbackProblem = "cancelled" | "failed" | null;

/**
 * Reads the error a provider or Supabase put on the callback URL. A user who
 * pressed "Cancel" on the provider's screen gets a calm message, not an error.
 */
export function callbackProblem(params: { get(name: string): string | null }): CallbackProblem {
  const code = params.get("error_code") ?? params.get("error");
  if (code === null && params.get("error_description") === null) return null;
  return code === "access_denied" ? "cancelled" : "failed";
}
