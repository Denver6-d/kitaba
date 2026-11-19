"use client";

import Link from "next/link";
import { letterDiff } from "@/domain/spelling/diff";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { HeroRound } from "@/features/landing/hero-round";
import { LetterDiff } from "@/features/games/letter-diff";

/** Each mode shown with a miniature of its mechanic, so the cards differ by what they show. */
const MODE_MINIS: ReadonlyArray<{ mode: string; href: string; mini: React.ReactNode }> = [
  { mode: "listen", href: "/play/game?mode=listen", mini: <span className="font-mono">♪ → kn_w</span> },
  { mode: "bee", href: "/play/game?mode=bee", mini: <span className="font-mono">60s · ×4</span> },
  { mode: "fix", href: "/play/game?mode=fix", mini: <span className="font-mono">I <s className="decoration-error">recieved</s> it.</span> },
  { mode: "missing", href: "/play/game?mode=missing", mini: <span className="font-mono tracking-widest">ne_e_sary</span> },
  { mode: "scramble", href: "/play/game?mode=scramble", mini: <span className="font-mono tracking-widest">P L E O E P</span> },
  { mode: "choice", href: "/play/game?mode=choice", mini: <span className="font-mono">accept · acept</span> },
  { mode: "review", href: "/review", mini: <span className="font-mono">1d · 6d · 15d</span> },
];

export default function HomePage() {
  const { t, lang } = useI18n();
  const display = lang === "en" ? "font-latin-display font-medium" : "font-bold";
  return (
    <>
      <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 pt-10 pb-16 sm:px-6 md:pt-16 lg:grid-cols-12 lg:gap-14 lg:pt-20">
        <div className="space-y-6 lg:col-span-5">
          <h1 className={`text-[2.5rem] leading-[1.12] tracking-tight sm:text-5xl xl:text-[3.6rem] ${display}`}>{t.home.headline}</h1>
          <p className="max-w-xl text-lg text-ink-soft">{t.home.sub}</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild size="lg" className="h-12 px-7 text-base">
              <Link href="/play/game?stage=w1-s1">{t.home.ctaPlay}</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 px-6 text-base">
              <Link href="/play">{t.nav.play}</Link>
            </Button>
          </div>
          <p className="text-sm text-ink-soft">{t.home.noAccount}</p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 border-t border-rule pt-5 text-ink-soft">
            <li>{t.home.factModes}</li>
            <li>{t.home.factWorlds}</li>
          </ul>
        </div>
        <div className="lg:col-span-7">
          <HeroRound />
        </div>
      </section>

      <section aria-labelledby="modes-h" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 id="modes-h" className={`mb-8 max-w-2xl text-3xl tracking-tight sm:text-4xl ${display}`}>
          {t.home.modesTitle}
        </h2>
        <ul className="grid gap-px overflow-hidden rounded-2xl border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-4">
          {MODE_MINIS.map(({ mode, href, mini }) => (
            <li key={mode} className="bg-sheet">
              <Link href={href} className="group flex h-full min-h-40 flex-col gap-3 p-6 transition-colors hover:bg-brass-wash">
                <span dir="ltr" lang="en" className="text-lg text-hint">
                  {mini}
                </span>
                <span className="text-lg font-semibold group-hover:underline group-hover:decoration-brass-fill group-hover:underline-offset-4">{t.modes[mode]?.name}</span>
                <span className="text-ink-soft">{t.modes[mode]?.desc}</span>
              </Link>
            </li>
          ))}
          <li className="flex items-center bg-ink p-6 text-paper sm:col-span-2 lg:col-span-1">
            <p className="text-lg">{t.home.finalBody}</p>
          </li>
        </ul>
      </section>

      <section aria-labelledby="rule-h" className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
        <div className="space-y-4">
          <h2 id="rule-h" className={`text-3xl tracking-tight sm:text-4xl ${display}`}>
            {t.home.ruleTitle}
          </h2>
          <p className="max-w-xl text-lg text-ink-soft">{t.home.ruleBody}</p>
        </div>
        <figure className="sheet space-y-4 p-6 sm:p-8">
          <p className="flex flex-wrap items-baseline gap-3">
            <span className="text-ink-soft">{t.game.yourAnswer}</span>
            <LetterDiff segments={letterDiff("recieve", "receive")} labels={{ missing: "+", extra: "−", wrong: "≠" }} />
          </p>
          <p className="flex flex-wrap items-baseline gap-3">
            <span className="text-ink-soft">{t.game.wrong}</span>
            <strong dir="ltr" lang="en" className="font-mono text-2xl">
              receive
            </strong>
          </p>
          <figcaption className="border-s-4 border-hint ps-3 text-hint">{t.home.ruleExampleRule}</figcaption>
        </figure>
      </section>

      <section aria-labelledby="honest-h" className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h2 id="honest-h" className="mb-4 font-semibold text-brass">
          {t.home.honestTitle}
        </h2>
        <p className="text-xl leading-relaxed sm:text-2xl">{t.home.honestBody}</p>
        <p className="mt-6 text-ink-soft">{t.home.privacyLine}</p>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-6 rounded-2xl bg-ink p-8 text-paper sm:p-12">
          <div className="max-w-lg space-y-2">
            <h2 className="text-2xl font-bold sm:text-3xl">{t.home.finalTitle}</h2>
            <p className="text-paper/85">{t.home.finalBody}</p>
          </div>
          <Button asChild size="lg" className="h-12 bg-brass-fill px-7 text-base text-[#14302e] hover:bg-brass-fill/90">
            <Link href="/play/game?stage=w1-s1">{t.home.ctaPlay}</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
