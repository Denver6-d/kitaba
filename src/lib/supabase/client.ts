"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Only the public project URL and the public anon key are ever used in the app.
 * Both are safe to expose: Row Level Security protects the data.
 * If either is missing, accounts are simply "not configured" and the app runs in guest mode.
 */
const URL_VALUE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function validUrl(u: string): boolean {
  try {
    const parsed = new URL(u);
    return parsed.protocol === "https:" || parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export const isSupabaseConfigured = (): boolean => validUrl(URL_VALUE) && ANON_KEY.length > 20;

let client: Promise<SupabaseClient> | null = null;

/**
 * Browser client (PKCE flow, session in cookies), or null when accounts are not configured.
 * The Supabase library is loaded on demand (DECISIONS OD14): it is not in any
 * page's first-load JavaScript, and a guest-only site never downloads it.
 */
export function loadSupabase(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured() || typeof window === "undefined") return Promise.resolve(null);
  client ??= import("@supabase/ssr").then(({ createBrowserClient }) => createBrowserClient(URL_VALUE, ANON_KEY));
  client.catch(() => {
    client = null;
  });
  return client;
}
