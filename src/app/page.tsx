"use client";

import Link from "next/link";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { HeroDemo } from "@/features/landing/hero-demo";
import { Story } from "@/features/landing/story";
import { SmoothScroll } from "@/features/landing/smooth-scroll";

export default function HomePage() {
  const { t, lang } = useI18n();
  const features = [
    { href: "/practice", title: t.nav.practice, body: t.home.featureTyping },
    { href: "/spelling", title: t.nav.spelling, body: t.home.featureSpelling },
    { href: "/sentences", title: t.nav.sentences, body: t.home.featureSentences },
    { href: "/professional", title: t.nav.professional, body: t.home.featureProfessional },
  ];

  return (
    <>
      <SmoothScroll />
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-12 pb-20 sm:px-6 md:pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-16">
        <div className="space-y-6">
          <h1
            className={`text-[2.4rem] leading-[1.15] font-bold tracking-tight sm:text-5xl lg:text-[3.4rem] ${lang === "en" ? "font-latin-display font-medium" : ""}`}
          >
            {t.home.headline}
          </h1>
          <p className="max-w-xl text-lg text-ink-soft">{t.home.sub}</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild size="lg" className="h-12 px-6 text-base transition-transform hover:-translate-y-px">
              <Link href="/diagnostic">{t.home.ctaDiagnostic}</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 px-6 text-base transition-transform hover:-translate-y-px">
              <Link href="/practice">{t.home.ctaPractice}</Link>
            </Button>
          </div>
        </div>
        <HeroDemo />
      </section>

      <div className="py-16 sm:py-24">
        <Story />
      </div>

      <section aria-labelledby="features-h" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 id="features-h" className="mb-10 max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
          {t.home.featuresTitle}
        </h2>
        <ul className="grid border-t border-rule md:grid-cols-2">
          {features.map((f) => (
            <li key={f.href} className="border-b border-rule md:odd:border-e md:odd:pe-10 md:even:ps-10">
              <Link href={f.href} className="group block py-8">
                <h3 className="text-xl font-semibold underline-offset-[6px] group-hover:underline group-hover:decoration-brass-fill">{f.title}</h3>
                <p className="mt-2 max-w-md text-ink-soft">{f.body}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="honest-h" className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h2 id="honest-h" className="mb-4 text-sm font-semibold text-brass">
          {t.home.honestTitle}
        </h2>
        <p className="text-xl leading-relaxed sm:text-2xl">{t.home.honestBody}</p>
        <p className="mt-6 text-ink-soft">{t.home.privacyLine}</p>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-6 rounded-2xl bg-ink p-8 text-paper sm:p-12">
          <div className="max-w-lg space-y-2">
            <h2 className="text-2xl font-bold sm:text-3xl">{t.home.finalTitle}</h2>
            <p className="text-paper/80">{t.home.finalBody}</p>
          </div>
          <Button asChild size="lg" className="h-12 bg-brass-fill px-6 text-base text-[#14302e] hover:bg-brass-fill/90">
            <Link href="/diagnostic">{t.home.ctaDiagnostic}</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
