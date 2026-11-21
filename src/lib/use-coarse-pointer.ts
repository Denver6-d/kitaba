"use client";

import { useSyncExternalStore } from "react";
import { COARSE_POINTER_QUERY, mayAutoFocusText } from "./auto-focus";

/**
 * True on a touch device (primary pointer coarse), for what a component renders
 * (DECISIONS M7, M9). False on the server and before hydration, so the first
 * client render matches the server; it updates if the primary pointer changes.
 * Event handlers can call mayAutoFocusText() directly instead.
 */
export function useCoarsePointer(): boolean {
  return useSyncExternalStore(subscribe, () => !mayAutoFocusText(), () => false);
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => undefined;
  const mql = window.matchMedia(COARSE_POINTER_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}
