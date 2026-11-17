"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Languages, Menu, Moon, Sun } from "lucide-react";
import { useI18n } from "@/i18n";
import { useResolvedTheme, useSettings } from "@/lib/settings-store";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "./logo";
import { MENU_NAV, PRIMARY_NAV } from "./nav-items";
import { SyncIndicator } from "@/features/account/sync-indicator";

export const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

/**
 * Opaque header (DESIGN.md V2): the name, the four core learning areas on
 * ≥ 768 px, and a three-line menu on every size. The menu is a Radix dialog:
 * it traps focus, closes on Esc and on an outside click, and returns focus to
 * the menu button. It opens from the end edge (left in Arabic, right in English).
 */
export function SiteHeader() {
  const { t, lang, setLang, dir } = useI18n();
  const [, update] = useSettings();
  const resolvedDark = useResolvedTheme() === "dark";
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="no-print sticky top-0 z-40 border-b border-rule bg-sheet">
      <a href="#main" className="sr-only-focusable absolute start-4 top-2 z-50 rounded-md bg-sheet px-3 py-2 shadow-float">
        {t.nav.skip}
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex min-h-11 items-center rounded-md">
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
                    className={`relative flex min-h-11 items-center rounded-md px-3 transition-colors hover:text-ink ${active ? "font-semibold text-ink" : "text-ink-soft"}`}
                  >
                    {item.label(t)}
                    {active && <span aria-hidden="true" className="absolute inset-x-3 -bottom-[11px] h-0.5 rounded-full bg-brass-fill" />}
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
                className="grid size-11 place-items-center rounded-md text-ink transition-colors hover:bg-muted"
              >
                <Menu className="size-6" aria-hidden="true" />
              </button>
            </SheetTrigger>
            <SheetContent side={dir === "rtl" ? "left" : "right"} closeLabel={t.common.close} className="w-[min(22rem,88vw)] gap-0 bg-sheet p-6">
              <SheetTitle className="mb-1 text-lg">{t.nav.menu}</SheetTitle>
              <SheetDescription className="sr-only">{t.nav.menu}</SheetDescription>
              {/* Phones also get the core areas here (the bottom bar hides while typing). */}
              <nav aria-label={t.nav.primary} className="mt-4 md:hidden">
                <ul className="space-y-1 border-b border-rule pb-4">
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
              <div className="mt-6 space-y-2 border-t border-rule pt-6">
                <button
                  type="button"
                  onClick={() => setLang(lang === "ar" ? "en" : "ar")}
                  className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-start transition-colors hover:bg-muted"
                >
                  <Languages className="size-5 text-ink-soft" aria-hidden="true" />
                  <span>
                    <span className="block text-sm text-ink-soft">{t.nav.language}</span>
                    {/* The accessible name starts with the visible text (WCAG 2.5.3). */}
                    <span lang={lang === "ar" ? "en" : "ar"} className="font-medium">
                      {t.nav.switchLang}
                    </span>
                    <span className="sr-only"> ({t.nav.switchLangLabel})</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => update({ theme: resolvedDark ? "light" : "dark" })}
                  className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-start transition-colors hover:bg-muted"
                >
                  {resolvedDark ? <Sun className="size-5 text-ink-soft" aria-hidden="true" /> : <Moon className="size-5 text-ink-soft" aria-hidden="true" />}
                  <span>
                    <span className="block text-sm text-ink-soft">{t.nav.theme}</span>
                    <span className="font-medium">{resolvedDark ? t.nav.themeLight : t.nav.themeDark}</span>
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
        className={`flex min-h-12 items-center rounded-lg px-3 text-lg transition-colors ${active ? "bg-brass-wash font-semibold" : "hover:bg-muted"}`}
      >
        {children}
      </Link>
    </li>
  );
}
