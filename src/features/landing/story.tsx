"use client";

import { useEffect, useRef } from "react";
import { useI18n } from "@/i18n";
import { prefersReducedMotion } from "@/lib/settings";
import { KeyboardSvg } from "@/features/keyboard/keyboard-svg";
import type { KeyStats } from "@/domain/typing/key-stats";

const DEMO_STATS: KeyStats = {
  b: { hits: 6, misses: 6 }, p: { hits: 8, misses: 5 }, v: { hits: 7, misses: 4 }, e: { hits: 40, misses: 6 },
  i: { hits: 30, misses: 5 }, a: { hits: 50, misses: 2 }, t: { hits: 40, misses: 1 }, o: { hits: 35, misses: 3 },
  n: { hits: 30, misses: 2 }, s: { hits: 30, misses: 1 }, h: { hits: 20, misses: 2 }, r: { hits: 25, misses: 3 },
  ",": { hits: 4, misses: 3 }, "'": { hits: 3, misses: 2 }, q: { hits: 3, misses: 1 }, f: { hits: 10, misses: 1 },
};

/**
 * Three-beat story. Default markup is a plain stacked layout (works with no JS
 * and with reduced motion). When motion is allowed on wide screens, GSAP
 * ScrollTrigger (loaded on demand) makes the visual column sticky and
 * cross-fades one visual per beat, scrubbed by scroll.
 */
export function Story() {
  const { t } = useI18n();
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el || prefersReducedMotion()) return;
    let cleanup = () => {};
    let cancelled = false;
    void (async () => {
      const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([import("gsap"), import("gsap/ScrollTrigger")]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      const mm = gsap.matchMedia();
      mm.add("(min-width: 900px) and (prefers-reduced-motion: no-preference)", () => {
        el.dataset.enhanced = "true";
        const visuals = gsap.utils.toArray<HTMLElement>("[data-visual]", el);
        const beats = gsap.utils.toArray<HTMLElement>("[data-beat]", el);
        gsap.set(visuals, { autoAlpha: 0, y: 16 });
        gsap.set(visuals[0] ?? [], { autoAlpha: 1, y: 0 });
        beats.forEach((beat, i) => {
          ScrollTrigger.create({
            trigger: beat,
            start: "top 60%",
            end: "bottom 40%",
            onToggle: (self) => {
              if (!self.isActive) return;
              visuals.forEach((v, j) =>
                gsap.to(v, { autoAlpha: j === i ? 1 : 0, y: j === i ? 0 : 16, duration: 0.5, ease: "power2.out", overwrite: true }),
              );
            },
          });
        });
        // Beat 1 detail: the correction draws in as the reader scrolls.
        gsap.fromTo(
          "[data-correction]",
          { clipPath: "inset(0 100% 0 0)" },
          { clipPath: "inset(0 0% 0 0)", ease: "none", scrollTrigger: { trigger: beats[0] ?? el, start: "top 70%", end: "center 45%", scrub: true } },
        );
        return () => {
          delete el.dataset.enhanced;
        };
      });
      cleanup = () => mm.revert();
    })();
    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);

  const visuals = [
    <figure key="v1" className="sheet space-y-4 p-6" dir="ltr" lang="en">
      <p className="font-mono text-lg text-ink-soft line-through decoration-error/70">{t.home.storyExampleWrong}</p>
      <p className="font-mono text-lg" data-correction>
        She <span className="rounded bg-[var(--correct-wash)] px-1 text-correct">went</span> to school yesterday.
      </p>
      <figcaption className="text-sm text-hint" dir="auto">
        {t.home.storyExampleNote}
      </figcaption>
    </figure>,
    <figure key="v2" className="sheet p-4">
      <KeyboardSvg stats={DEMO_STATS} label={t.learn.heatmap} />
    </figure>,
    <figure key="v3" className="sheet space-y-3 p-6" dir="ltr" lang="en">
      {[
        ["receive", "1"],
        ["beautiful", "3"],
        ["Wednesday", "7"],
      ].map(([w, d]) => (
        <div key={w} className="flex items-center justify-between border-b border-rule pb-3 last:border-0 last:pb-0">
          <span className="font-mono text-lg">{w}</span>
          <span className="rounded-full bg-brass-wash px-3 py-1 text-sm tabular">+{d}d</span>
        </div>
      ))}
    </figure>,
  ];

  const beats = [
    { title: t.home.story1Title, body: t.home.story1Body },
    { title: t.home.story2Title, body: t.home.story2Body },
    { title: t.home.story3Title, body: t.home.story3Body },
  ];

  return (
    <section ref={root} aria-labelledby="story-h" className="group/story mx-auto max-w-6xl px-4 sm:px-6">
      <h2 id="story-h" className="mb-12 max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
        {t.home.storyTitle}
      </h2>
      <div className="grid gap-12 group-data-[enhanced=true]/story:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <ol className="space-y-16 group-data-[enhanced=true]/story:space-y-[38vh] group-data-[enhanced=true]/story:py-[18vh]">
          {beats.map((b, i) => (
            <li key={b.title} data-beat className="max-w-md space-y-3">
              <p className="font-latin-display text-sm text-brass" aria-hidden="true">
                <span dir="ltr">{i + 1} / 3</span>
              </p>
              <h3 className="text-2xl font-semibold">{b.title}</h3>
              <p className="text-ink-soft">{b.body}</p>
              {/* Inline visual for the stacked (default) layout. */}
              <div className="pt-4 group-data-[enhanced=true]/story:hidden">{visuals[i]}</div>
            </li>
          ))}
        </ol>
        <div className="hidden group-data-[enhanced=true]/story:block" aria-hidden="true">
          <div className="sticky top-[22vh] grid">
            {visuals.map((v, i) => (
              <div key={i} data-visual className="col-start-1 row-start-1">
                {v}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
