"use client";

import Link from "next/link";
import { useI18n } from "@/i18n";
import { SECONDARY_NAV } from "./nav-items";
import { Logo } from "./logo";

export function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="no-print mt-24 border-t border-rule">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1fr_auto]">
        <div className="max-w-md space-y-3">
          <Logo />
          <p className="text-sm text-ink-soft">{t.common.honest}</p>
          <p className="text-sm text-ink-soft">{t.home.privacyLine}</p>
        </div>
        <nav aria-label={t.nav.menu}>
          <ul className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            {SECONDARY_NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-ink-soft underline-offset-4 hover:text-ink hover:underline">
                  {item.label(t)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
