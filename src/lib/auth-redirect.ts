import { safeNext } from "./safe-next";

/**
 * OAuth and email-link redirects (DECISIONS O1). The app only ever sends
 * Supabase back to its own origin's /auth/callback, with a `next` path that
 * passed safeNext, so a crafted link can never bounce a signed-in user to
 * another site. Supabase must also list that exact URL as an allowed redirect.
 */

/** OAuth providers the code supports. Google only (DECISIONS R7); Apple needs a paid developer account. */
export const OAUTH_PROVIDERS = ["google"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export const PROVIDER_LABELS: Readonly<Record<OAuthProvider, string>> = { google: "Google" };

/**
 * Providers shown on the sign-in screen: Google only when
 * NEXT_PUBLIC_ENABLE_GOOGLE_SIGNIN is exactly "true" (default off), because a
 * Google button for a project without the Google provider set up only fails.
 * Email sign-in has its own flag (emailSignInEnabled).
 */
export function enabledOAuthProviders(googleFlag: string | undefined): readonly OAuthProvider[] {
  return OAUTH_PROVIDERS.filter((p) => p !== "google" || googleFlag?.trim() === "true");
}

/** Read with the literal name, so Next.js inlines the public value at build time. */
export const ENABLED_OAUTH_PROVIDERS: readonly OAuthProvider[] = enabledOAuthProviders(process.env.NEXT_PUBLIC_ENABLE_GOOGLE_SIGNIN);

/**
 * Email sign-in (password sign-in and sign-up, magic link, password reset),
 * only when NEXT_PUBLIC_ENABLE_EMAIL_SIGNIN is exactly "true" (default off,
 * DECISIONS O6). Supabase's built-in mailer only sends to the project's own
 * members, so without a custom SMTP server real visitors never get the email.
 */
export function emailSignInEnabled(emailFlag: string | undefined): boolean {
  return emailFlag?.trim() === "true";
}

/** Read with the literal name, so Next.js inlines the public value at build time. */
export const EMAIL_SIGNIN_ENABLED: boolean = emailSignInEnabled(process.env.NEXT_PUBLIC_ENABLE_EMAIL_SIGNIN);

/** What the sign-in screen shows for the enabled methods. */
export interface SignInLayout {
  readonly oauth: readonly OAuthProvider[];
  readonly email: boolean;
  /** The "or with email" divider: only between OAuth buttons and the email forms. */
  readonly divider: boolean;
  /** No method at all: the page explains that accounts are not available yet. */
  readonly none: boolean;
}

export function signInLayout(oauth: readonly OAuthProvider[], email: boolean): SignInLayout {
  return { oauth, email, divider: oauth.length > 0 && email, none: oauth.length === 0 && !email };
}

export const isOAuthProvider =(v: unknown): v is OAuthProvider => typeof v === "string" && (OAUTH_PROVIDERS as readonly string[]).includes(v);

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
  const error = params.get("error");
  const code = params.get("error_code");
  if (error === null && code === null && params.get("error_description") === null) return null;
  // Supabase may send its own error_code next to the provider's error: either one saying
  // access_denied means the person pressed Cancel on the provider's screen.
  return error === "access_denied" || code === "access_denied" ? "cancelled" : "failed";
}
