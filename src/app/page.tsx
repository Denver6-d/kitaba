"use client";

import Link from "next/link";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const { t, lang } = useI18n();
  return (
    <section className="mx-auto max-w-6xl space-y-6 px-4 pt-12 pb-20 sm:px-6 md:pt-20">
      <h1 className={`max-w-3xl text-[2.4rem] leading-[1.15] font-bold tracking-tight sm:text-5xl ${lang === "en" ? "font-latin-display font-medium" : ""}`}>
        {t.home.headline}
      </h1>
      <p className="max-w-2xl text-lg text-ink-soft">{t.home.sub}</p>
      <div className="flex flex-wrap gap-3 pt-2">
        <Button asChild size="lg" className="h-12 px-6 text-base">
          <Link href="/play/game?stage=w1-s1">{t.home.ctaPlay}</Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="h-12 px-6 text-base">
          <Link href="/review">{t.home.ctaReview}</Link>
        </Button>
      </div>
    </section>
  );
}
