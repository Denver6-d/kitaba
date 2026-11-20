"use client";

import { useEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from "react";

/**
 * Fades its content up softly on entry (0.7 s, DESIGN.md V3). `delay`
 * staggers siblings.
 * - Default: for content below the fold, it fades in the first time it
 *   scrolls into view (IntersectionObserver).
 * - `immediate`: for content visible on load (titles, the hero), a CSS
 *   fade that starts at first paint and never waits for hydration.
 * Only while html[data-reveal] is set (motion allowed, set before paint), so
 * reduced motion shows everything at once. The content is in the DOM and
 * readable from the start.
 */
export function Reveal({
  as: Tag = "div",
  delay = 0,
  immediate = false,
  className,
  children,
  ...rest
}: {
  as?: ElementType;
  delay?: number;
  immediate?: boolean;
  className?: string;
  children: ReactNode;
} & Record<string, unknown>) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    // From now on the observer owns the timing; the 3 s CSS safety net stands down.
    document.documentElement.dataset.revealReady = "";
    const el = ref.current;
    if (immediate || !el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.dataset.shown = "";
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.dataset.shown = "";
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [immediate]);
  const style = delay ? ({ "--reveal-delay": `${delay}ms` } as CSSProperties) : undefined;
  const marker = immediate ? { "data-reveal-now": "" } : { "data-reveal-item": "" };
  return (
    <Tag ref={ref} {...marker} className={className} style={style} {...rest}>
      {children}
    </Tag>
  );
}
