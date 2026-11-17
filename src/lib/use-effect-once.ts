"use client";

import { useEffect, useRef } from "react";

/** Runs an async-starting effect once per mount (guarded against Strict Mode double invocation). */
export function useEffectOnce(effect: () => void): void {
  const ran = useRef(false);
  const fn = useRef(effect);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    fn.current();
  }, []);
}
