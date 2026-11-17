"use client";

import { useSyncExternalStore } from "react";
import { prefersReducedMotion } from "./settings";

const noopSubscribe = () => () => {};

/** False during SSR and hydration, true afterwards. Lets random or browser-only content render without a mismatch. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

function subscribeMotion(cb: () => void): () => void {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
  return () => {
    mq.removeEventListener("change", cb);
    obs.disconnect();
  };
}

/** Reduced motion from the OS or the manual setting. Assumed true on the server (safe default). */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeMotion, prefersReducedMotion, () => true);
}

let pageLoadSeed: number | null = null;
const getClientSeed = () => (pageLoadSeed ??= Math.floor(Math.random() * 1e9));

/**
 * A random seed chosen once per page load, read only on the client (0 during
 * prerender), so practice text is varied without Math.random() in render.
 */
export function useClientSeed(): number {
  return useSyncExternalStore(noopSubscribe, getClientSeed, () => 0);
}
