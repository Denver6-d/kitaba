"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Languages, Menu } from "lucide-react";
import { useI18n } from "@/i18n";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "./logo";
import { MENU_NAV, PRIMARY_NAV } from "./nav-items";
import { SyncIndicator } from "@/features/account/sync-indicator";

export const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

/**
 * Opaque header (DESIGN.md V3): the name, the core learning areas from 768 px
 * up, and a menu button on every size. The menu is a Radix dialog: it traps
 * focus, closes on Esc and on an outside click, and returns focus to the menu
 * button. It opens from the end edge (left in Arabic, right in English).
 */
export function SiteHeader() {
  const { t, lang, setLang, dir } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="no-print sticky top-0 z-40 border-b border-line bg-canvas">
      <a href="#main" className="sr-only-focusable absolute start-4 top-2 z-50 rounded-full border border-line-strong bg-raised px-4 py-2">
        {t.nav.skip}
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6 md:h-[4.5rem]">
        <Link href="/" className="flex min-h-11 items-center rounded-full">
          <Logo />
        </Link>

        <nav aria-label={t.nav.primary} className="hidden flex-1 md:block">
          <ul className="flex items-center gap-1">
            {PRIMARY_NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-11 items-center rounded-full px-3.5 text-[0.9375rem] transition-colors hover:text-fg ${active ? "bg-raised font-medium text-fg" : "text-fg-2"}`}
                  >
                    {item.label(t)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ms-auto flex items-center gap-1">
          <SyncIndicator />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label={t.nav.openMenu}
                className="grid size-11 place-items-center rounded-full border border-line text-fg transition-colors hover:border-line-strong hover:bg-raised"
              >
                <Menu className="size-5" strokeWidth={1.5} aria-hidden="true" />
              </button>
            </SheetTrigger>
            <SheetContent side={dir === "rtl" ? "left" : "right"} closeLabel={t.common.close} className="w-[min(22rem,88vw)] gap-0 p-6 pt-5">
              <SheetTitle className="mb-1 text-lg font-light text-fg-2">{t.nav.menu}</SheetTitle>
              <SheetDescription className="sr-only">{`${t.nav.leaderboard}، ${t.nav.account}، ${t.nav.settings}، ${t.nav.language}`}</SheetDescription>
              {/* Phones also get the core areas here (the bottom bar hides while typing). */}
              <nav aria-label={t.nav.primary} className="mt-4 md:hidden">
                <ul className="space-y-1 border-b border-line pb-4">
                  {PRIMARY_NAV.map((item) => (
                    <MenuLink key={item.href} href={item.href} active={isActive(pathname, item.href)} onNavigate={() => setOpen(false)}>
                      {item.label(t)}
                    </MenuLink>
                  ))}
                </ul>
              </nav>
              <nav aria-label={t.nav.menu} className="mt-4">
                <ul className="space-y-1">
                  {MENU_NAV.map((item) => (
                    <MenuLink key={item.href} href={item.href} active={isActive(pathname, item.href)} onNavigate={() => setOpen(false)}>
                      {item.label(t)}
                    </MenuLink>
                  ))}
                </ul>
              </nav>
              <div className="mt-6 border-t border-line pt-6">
                <button
                  type="button"
                  onClick={() => setLang(lang === "ar" ? "en" : "ar")}
                  className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-start transition-colors hover:bg-raised"
                >
                  <Languages className="size-5 text-fg-2" strokeWidth={1.5} aria-hidden="true" />
                  <span>
                    <span className="block text-sm text-fg-2">{t.nav.language}</span>
                    {/* The accessible name starts with the visible text (WCAG 2.5.3). */}
                    <span lang={lang === "ar" ? "en" : "ar"} className="font-medium">
                      {t.nav.switchLang}
                    </span>
                    <span className="sr-only"> ({t.nav.switchLangLabel})</span>
                  </span>
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

function MenuLink({ href, active, onNavigate, children }: { href: string; active: boolean; onNavigate: () => void; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={`flex min-h-12 items-center rounded-2xl px-3 text-lg transition-colors ${active ? "bg-raised font-medium text-fg" : "text-fg-2 hover:bg-raised hover:text-fg"}`}
      >
        {children}
      </Link>
    </li>
  );
}
