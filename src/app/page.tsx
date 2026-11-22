"use client";

import Link from "next/link";
import { Ear, Keyboard, Lightbulb } from "lucide-react";
import { WORLDS } from "@/domain/games/campaign";
import { CATEGORY_INFO } from "@/data/rules";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { MomentLabel } from "@/components/ui/card";
import { Reveal } from "@/components/reveal";
import { MiniGame } from "@/features/landing/mini-game";
import { useHydrated } from "@/lib/use-hydrated";
import { hasLevelsMarker } from "@/lib/first-visit";

/** One section per screen height (DESIGN.md V3, landing), content centred vertically. */
const SCREEN = "flex min-h-[calc(100svh-4rem)] flex-col justify-center py-16 md:min-h-[calc(100svh-4.5rem)] md:py-24";
const STEP_ICONS = [Ear, Keyboard, Lightbulb] as const;

export default function HomePage() {
  const { t, lang } = useI18n();
  // A learner who already has a level continues; the test is offered only once (DECISIONS L2). Retaking is in Settings.
  const hasLevels = useHydrated() && hasLevelsMarker();
  return (
    <>
      <section aria-labelledby="hero-h" className={`mx-auto max-w-6xl px-4 sm:px-6 ${SCREEN}`}>
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="space-y-7 lg:col-span-6">
            <Reveal immediate as="h1" id="hero-h" className="text-[clamp(2.5rem,8vw,4.5rem)] leading-[1.05] font-light">
              {t.home.headline}
            </Reveal>
            <Reveal immediate as="p" delay={120} className="max-w-xl text-lg text-fg-2 sm:text-xl">
              {t.home.sub}
            </Reveal>
            <Reveal immediate delay={240} className="space-y-4 pt-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {/* The header's "Start free" appears only once this button has scrolled away (DECISIONS R8). */}
                <Button id="hero-cta" variant="primary" asChild size="lg">
                  {hasLevels ? <Link href="/play">{t.home.ctaContinue}</Link> : <Link href="/welcome?test=1">{t.home.ctaTest}</Link>}
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/play/game?stage=w1-s1">{t.home.ctaTry}</Link>
                </Button>
              </div>
              <p className="text-sm text-fg-3">{t.home.noAccount}</p>
            </Reveal>
          </div>
          <Reveal immediate delay={360} className="lg:col-span-6">
            <MiniGame />
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="steps-h" className={`mx-auto max-w-6xl px-4 sm:px-6 ${SCREEN}`}>
        <Reveal as="h2" id="steps-h" className="mb-10 max-w-2xl text-[clamp(2rem,6vw,3.25rem)] leading-tight font-light sm:mb-14">
          {t.home.stepsTitle}
        </Reveal>
        <ol className="grid gap-4 md:grid-cols-3">
          {t.home.steps.map((step, i) => {
            const Icon = STEP_ICONS[i] ?? Ear;
            return (
              <Reveal as="li" key={step.title} delay={i * 120} className="panel flex flex-col gap-5 p-6 sm:p-8">
                <div className="flex items-center justify-between">
                  <span className="grid size-11 place-items-center rounded-full border border-line-strong font-latin text-fg-2 tabular" aria-hidden="true">
                    {i + 1}
                  </span>
                  <Icon className="size-6 text-fg-3" strokeWidth={1.5} aria-hidden="true" />
                </div>
                <h3 className="text-2xl font-light">{step.title}</h3>
                <p className="text-fg-2">{step.body}</p>
              </Reveal>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="worlds-h" className={`mx-auto max-w-6xl px-4 sm:px-6 ${SCREEN}`}>
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6 sm:mb-14">
          <div className="max-w-2xl space-y-4">
            <Reveal as="h2" id="worlds-h" className="text-[clamp(2rem,6vw,3.25rem)] leading-tight font-light">
              {t.home.worldsTitle}
            </Reveal>
            <Reveal as="p" delay={120} className="text-lg text-fg-2">
              {t.home.worldsIntro}
            </Reveal>
          </div>
          <Button asChild variant="outline">
            <Link href="/play">{t.home.worldsCta}</Link>
          </Button>
        </div>
        {/* The path: a hairline joins the worlds, down the side on phones, across the rows on wide screens. */}
        <ol className="relative grid gap-x-6 gap-y-8 border-s border-line ps-6 sm:grid-cols-2 sm:border-0 sm:ps-0 lg:grid-cols-4">
          {WORLDS.map((w, i) => (
            <Reveal as="li" key={w.n} delay={(i % 4) * 90} className="relative space-y-2 sm:border-t sm:border-line sm:pt-6">
              <span
                className="absolute -start-[calc(1.5rem+0.4rem)] top-1.5 size-3 rounded-full border border-line-strong bg-canvas sm:start-0 sm:-top-1.5"
                aria-hidden="true"
              />
              <p className="text-sm text-fg-3 tabular">{t.play.world(w.n)}</p>
              <h3 className="text-xl leading-snug font-normal">{w.name[lang]}</h3>
              <p className="text-sm text-fg-2">{w.categories.map((c) => CATEGORY_INFO[c].label[lang]).join(lang === "ar" ? "، " : ", ")}</p>
              <p className="text-sm text-fg-3">
                <span className="font-latin tabular" dir="ltr" lang="en">
                  {w.levels[0]}–{w.levels[w.levels.length - 1]}
                </span>
              </p>
            </Reveal>
          ))}
        </ol>
      </section>

      <section aria-labelledby="honest-h" className={`mx-auto max-w-6xl px-4 sm:px-6 ${SCREEN}`}>
        <Reveal className="moment space-y-5 p-8 sm:p-14">
          <MomentLabel>{t.home.honestLabel}</MomentLabel>
          <h2 id="honest-h" className="max-w-3xl text-[clamp(2rem,6vw,3.25rem)] leading-tight font-light text-on-mint">
            {t.home.honestTitle}
          </h2>
          <p className="max-w-2xl text-lg text-on-mint-2 sm:text-xl">{t.home.honestBody}</p>
          <p className="max-w-2xl border-t border-on-mint/15 pt-5 text-on-mint-2">{t.home.privacyLine}</p>
        </Reveal>
      </section>
    </>
  );
}
