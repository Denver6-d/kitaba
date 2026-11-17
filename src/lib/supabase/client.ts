"use client";

import { createBrowserClient } from "@supabase/ssr";
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

let client: SupabaseClient | null = null;

/** Browser client (PKCE flow, session in cookies). null when accounts are not configured. */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured() || typeof window === "undefined") return null;
  client ??= createBrowserClient(URL_VALUE, ANON_KEY);
  return client;
}
