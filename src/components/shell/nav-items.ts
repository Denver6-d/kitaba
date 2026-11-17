import type { Dictionary } from "@/i18n/ar";

export interface NavItem {
  readonly href: string;
  readonly label: (t: Dictionary) => string;
}

export const PRIMARY_NAV: readonly NavItem[] = [
  { href: "/practice", label: (t) => t.nav.practice },
  { href: "/learn", label: (t) => t.nav.learn },
  { href: "/spelling", label: (t) => t.nav.spelling },
  { href: "/sentences", label: (t) => t.nav.sentences },
  { href: "/professional", label: (t) => t.nav.professional },
  { href: "/stats", label: (t) => t.nav.stats },
];

export const SECONDARY_NAV: readonly NavItem[] = [
  { href: "/achievements", label: (t) => t.nav.achievements },
  { href: "/leaderboard", label: (t) => t.nav.leaderboard },
  { href: "/account", label: (t) => t.nav.account },
  { href: "/settings", label: (t) => t.nav.settings },
  { href: "/privacy", label: (t) => t.nav.privacy },
];
