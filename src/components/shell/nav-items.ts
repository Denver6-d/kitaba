import type { Dictionary } from "@/i18n/ar";

export interface NavItem {
  readonly href: string;
  readonly label: (t: Dictionary) => string;
}

/** The core learning areas: the main bar (and the bottom bar on phones). */
export const PRIMARY_NAV: readonly NavItem[] = [
  { href: "/", label: (t) => t.nav.home },
  { href: "/play", label: (t) => t.nav.play },
  { href: "/write", label: (t) => t.nav.write },
  { href: "/review", label: (t) => t.nav.review },
  { href: "/progress", label: (t) => t.nav.progress },
];

/** Everything else lives in the menu. */
export const MENU_NAV: readonly NavItem[] = [
  { href: "/leaderboard", label: (t) => t.nav.leaderboard },
  { href: "/account", label: (t) => t.nav.account },
  { href: "/settings", label: (t) => t.nav.settings },
  { href: "/privacy", label: (t) => t.nav.privacy },
  { href: "/credits", label: (t) => t.nav.credits },
];
