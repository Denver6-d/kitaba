"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, Moon, Settings2, Sun } from "lucide-react";
import { useI18n } from "@/i18n";
import { useResolvedTheme, useSettings } from "@/lib/settings-store";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "./logo";
import { PRIMARY_NAV, SECONDARY_NAV } from "./nav-items";
import { SyncIndicator } from "@/features/account/sync-indicator";

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

export function SiteHeader() {
  const { t, lang, setLang } = useI18n();
  const [, update] = useSettings();
  const resolvedDark = useResolvedTheme() === "dark";
  const pathname = usePathname();
  const [open, setOpen] = useState(false);


  return (
    <header className="glass no-print sticky top-0 z-40 border-b border-rule/70">
      <a
        href="#main"
        className="sr-only-focusable absolute start-4 top-2 z-50 rounded-md bg-sheet px-3 py-2 text-sm shadow-float"
      >
        {t.nav.skip}
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="rounded-md py-1">
          <Logo />
        </Link>

        <nav aria-label={t.nav.primary} className="hidden flex-1 lg:block">
          <ul className="flex items-center gap-1">
            {PRIMARY_NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`relative rounded-md px-3 py-2 text-sm transition-colors hover:text-ink ${
                      active ? "font-semibold text-ink" : "text-ink-soft"
                    }`}
                  >
                    {item.label(t)}
                    {active && <span aria-hidden="true" className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-brass-fill" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ms-auto flex items-center gap-1">
          <SyncIndicator />
          <button
            type="button"
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            className="rounded-md px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-muted hover:text-ink"
          >
            {/* The accessible name starts with the visible text (WCAG 2.5.3), then explains the action. */}
            <span lang={lang === "ar" ? "en" : "ar"}>{t.nav.switchLang}</span>
            <span className="sr-only"> ({t.nav.switchLangLabel})</span>
          </button>
          <button
            type="button"
            onClick={() => update({ theme: resolvedDark ? "light" : "dark" })}
            aria-label={resolvedDark ? t.nav.themeLight : t.nav.themeDark}
            className="grid size-10 place-items-center rounded-md text-ink-soft transition-colors hover:bg-muted hover:text-ink"
          >
            {resolvedDark ? <Sun className="size-[18px]" aria-hidden="true" /> : <Moon className="size-[18px]" aria-hidden="true" />}
          </button>
          <Link
            href="/settings"
            aria-label={t.nav.settings}
            className="hidden size-10 place-items-center rounded-md text-ink-soft transition-colors hover:bg-muted hover:text-ink sm:grid"
          >
            <Settings2 className="size-[18px]" aria-hidden="true" />
          </Link>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label={t.nav.menu}
                className="grid size-10 place-items-center rounded-md text-ink-soft hover:bg-muted hover:text-ink lg:hidden"
              >
                <Menu className="size-5" aria-hidden="true" />
              </button>
            </SheetTrigger>
            <SheetContent side={lang === "ar" ? "left" : "right"} closeLabel={t.common.close} className="w-[min(20rem,85vw)] p-6">
              <SheetTitle className="mb-2">
                <Logo />
              </SheetTitle>
              <nav aria-label={t.nav.primary}>
                <ul className="space-y-1">
                  {[...PRIMARY_NAV, ...SECONDARY_NAV].map((item, i) => {
                    const active = isActive(pathname, item.href);
                    return (
                      <li key={item.href} className={i === PRIMARY_NAV.length ? "mt-4 border-t border-rule pt-4" : ""}>
                        <Link
                          href={item.href}
                          onClick={() => setOpen(false)}
                          aria-current={active ? "page" : undefined}
                          className={`block rounded-md px-3 py-2.5 text-base ${active ? "bg-brass-wash font-semibold" : "hover:bg-muted"}`}
                        >
                          {item.label(t)}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
