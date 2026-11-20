"use client";

import { useEffect } from "react";

/**
 * How much of the layout viewport the on-screen keyboard covers, in CSS px.
 * Android Chrome shrinks the layout itself (`interactive-widget=resizes-content`),
 * so this is 0 there. iOS Safari keeps the layout and shrinks only the visual
 * viewport, so sticky action bars must be lifted by this much to stay above the
 * keyboard. Pinch-zoom also shrinks the visual viewport, so a zoomed page is 0.
 */
export function keyboardInset(layoutHeight: number, vv: { height: number; offsetTop: number; scale: number } | null): number {
  if (!vv || vv.scale > 1.01) return 0;
  const covered = layoutHeight - vv.height - vv.offsetTop;
  // Small differences are browser chrome (the URL bar), not a keyboard.
  return covered > 80 ? Math.round(covered) : 0;
}

/**
 * Keeps `--keyboard-inset` on <html> up to date while a screen with a typing
 * field is mounted (DESIGN.md V3, mobile). Sticky bars use it as their bottom.
 */
export function useKeyboardInset(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    let last = -1;
    // clientHeight is the layout viewport (innerHeight can follow the visual viewport on iOS).
    // Write only on change: every write restyles the document while the keyboard is open.
    const update = () => {
      const inset = keyboardInset(root.clientHeight, vv);
      if (inset === last) return;
      last = inset;
      root.style.setProperty("--keyboard-inset", `${inset}px`);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      root.style.removeProperty("--keyboard-inset");
    };
  }, []);
}
