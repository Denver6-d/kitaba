"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "@/lib/use-hydrated";

const easeOut = (p: number) => 1 - (1 - p) ** 3;

/** Counts up to `value` once (ease-out, ~0.8 s). Shows the final value immediately with reduced motion. */
export function AnimatedNumber({ value, format, durationMs = 800 }: { value: number; format: (n: number) => string; durationMs?: number }) {
  const reduced = useReducedMotion();
  const [anim, setAnim] = useState<{ target: number; p: number }>({ target: value, p: 0 });

  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      setAnim({ target: value, p });
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs, reduced]);

  const shown = reduced ? value : anim.target === value ? value * easeOut(anim.p) : 0;

  return (
    <>
      <span aria-hidden="true">{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </>
  );
}
