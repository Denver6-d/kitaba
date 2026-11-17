"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { BookOpenCheck, ChartNoAxesColumn, Gamepad2, House } from "lucide-react";
import { useI18n } from "@/i18n";
import { PRIMARY_NAV } from "./nav-items";
import { isActive } from "./site-header";

const ICONS: Record<string, typeof House> = { "/": House, "/play": Gamepad2, "/review": BookOpenCheck, "/progress": ChartNoAxesColumn };

function subscribeViewport(cb: () => void) {
  const vv = window.visualViewport;
  vv?.addEventListener("resize", cb);
  return () => vv?.removeEventListener("resize", cb);
}
/** True when the on-screen keyboard (or anything else) takes a large part of the screen. */
const keyboardOpen = () => (window.visualViewport ? window.visualViewport.height < window.innerHeight * 0.75 : false);

/**
 * Phones: the four core areas within thumb reach. Hidden on the game screen,
 * which has its own bottom action, and while the keyboard is open.
 */
export function BottomNav() {
  const { t } = useI18n();
  const pathname = usePathname();
  const typing = useSyncExternalStore(subscribeViewport, keyboardOpen, () => false);
  if (pathname.startsWith("/play/game") || typing) return null;
  return (
    <nav aria-label={t.nav.bottom} className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-sheet pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {PRIMARY_NAV.map((item) => {
          const Icon = ICONS[item.href] ?? House;
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs ${active ? "font-semibold text-ink" : "text-ink-soft"}`}
              >
                <Icon className={`size-5 ${active ? "text-brass" : ""}`} aria-hidden="true" />
                {item.label(t)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
