"use client";

import { useEffect } from "react";
import { useReducedMotion } from "@/lib/use-hydrated";

/**
 * Lenis smooth scrolling, on the landing page only (never on typing screens).
 * Loaded on demand and skipped entirely with reduced motion.
 */
export function SmoothScroll() {
  // Re-evaluated when the OS or in-app motion setting changes.
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    let destroy = () => {};
    let cancelled = false;
    void (async () => {
      const [{ default: Lenis }, { default: gsap }, { ScrollTrigger }] = await Promise.all([
        import("lenis"),
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      const lenis = new Lenis({ autoRaf: false });
      lenis.on("scroll", ScrollTrigger.update);
      const tick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      destroy = () => {
        gsap.ticker.remove(tick);
        gsap.ticker.lagSmoothing(500, 33);
        lenis.destroy();
      };
    })();
    return () => {
      cancelled = true;
      destroy();
    };
  }, [reduced]);
  return null;
}
