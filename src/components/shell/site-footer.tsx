"use client";

import { useI18n } from "@/i18n";
import { Logo } from "./logo";

/** The footer keeps only the name and one short line; everything else is in the menu. */
export function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="no-print mt-24 border-t border-line pb-16 md:pb-0">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-10 sm:px-6">
        <Logo />
        <p className="text-sm text-fg-3">{t.footer.line}</p>
      </div>
    </footer>
  );
}
