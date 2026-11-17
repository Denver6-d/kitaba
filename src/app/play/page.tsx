"use client";

import Link from "next/link";
import { useI18n } from "@/i18n";
import { Page } from "@/components/page";
import { FREE_MODES, freePlayHref } from "@/features/games/parse-request";

export default function PlayPage() {
  const { t } = useI18n();
  return (
    <Page title={t.play.title} intro={t.play.intro}>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FREE_MODES.map((m) => (
          <li key={m}>
            <Link href={freePlayHref(m, null, null)} className="sheet block h-full p-5 transition-colors hover:border-brass-fill">
              <h2 className="text-lg font-semibold">{t.modes[m]?.name}</h2>
              <p className="mt-1 text-ink-soft">{t.modes[m]?.desc}</p>
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  );
}
