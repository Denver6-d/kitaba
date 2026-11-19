import { safeNext } from "./safe-next";

/**
 * First visit (DECISIONS L1): a visitor with no stored level is sent to
 * /welcome on the first page they open, then back to that page.
 *
 * - The pre-paint script (lib/settings.ts) hides <main> on gated pages until
 *   the client decides, so the page never flashes before the redirect.
 * - The decision is a pure function (`gateDecision`), so it is tested without a browser.
 * - localStorage holds a small marker once levels exist, so returning visitors
 *   are never hidden, not even for a frame.
 */

/** localStorage key set once the learner has levels (choice, placement or skip). */
export const LEVELS_MARKER = "kitaba:levels-set";

/** Remembers (or forgets) that this browser has levels; storage errors are ignored. */
export function rememberLevels(set: boolean): void {
  try {
    if (set) localStorage.setItem(LEVELS_MARKER, "1");
    else localStorage.removeItem(LEVELS_MARKER);
  } catch {
    // Storage blocked: the page is simply shown after the check each time.
  }
}

/** Pages that never redirect: the welcome screen itself, legal and credits pages, auth and sign-in, the offline fallback. */
export const GATE_EXEMPT_PREFIXES = ["/welcome", "/privacy", "/credits", "/offline", "/auth", "/account"] as const;

/** True when opening `pathname` should first ask a new visitor for a level. */
export function shouldGate(pathname: string): boolean {
  if (!pathname.startsWith("/")) return false;
  // Not pages: API routes, framework assets, the service worker, static files.
  if (/^\/(api|_next|content|dict)(\/|$)/.test(pathname) || /\.[a-z0-9]+$/i.test(pathname)) return false;
  return !GATE_EXEMPT_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** /welcome?next=<the page the visitor asked for> (path and query only, same origin). */
export function welcomeHref(pathname: string, search: string): string {
  const target = `${pathname}${search && search !== "?" ? (search.startsWith("?") ? search : `?${search}`) : ""}`;
  return target === "/play" || !shouldGate(pathname) ? "/welcome" : `/welcome?next=${encodeURIComponent(target)}`;
}

/** Where to go after the welcome screen: a same-origin path, never /welcome itself (no loop). */
export function returnPath(next: string | null | undefined): string {
  const path = safeNext(next, "/play");
  return path === "/welcome" || path.startsWith("/welcome?") || path.startsWith("/welcome/") || path.startsWith("/welcome#") ? "/play" : path;
}

export interface GateInput {
  readonly pathname: string;
  /** The profile's levelSource once read; undefined while loading; "error" if it could not be read. */
  readonly levelSource: string | null | undefined | "error";
  /** False when IndexedDB is unavailable (private mode): progress is not kept, so never insist. */
  readonly persistent: boolean;
  readonly accountReady: boolean;
  readonly signedIn: boolean;
  /** The first sync's status for a signed-in learner (levels may be in the account). */
  readonly syncStatus: string | null;
  /** True once the safety wait ran out. */
  readonly timedOut: boolean;
}

export type GateDecision = "wait" | "show" | "welcome";

export function gateDecision(g: GateInput): GateDecision {
  if (!shouldGate(g.pathname) || !g.persistent) return "show";
  if (g.levelSource === "error") return "show";
  if (g.levelSource === undefined) return g.timedOut ? "show" : "wait";
  if (g.levelSource !== null) return "show";
  // A signed-in learner on a new device: wait for the first sync, which may bring the levels.
  if (!g.accountReady || (g.signedIn && g.syncStatus !== "synced" && g.syncStatus !== "offline" && g.syncStatus !== "error")) return g.timedOut ? "show" : "wait";
  return "welcome";
}

/**
 * The part that runs before first paint (inlined into PRE_PAINT_SCRIPT): hide
 * <main> on a gated page when this browser has never stored levels.
 */
export const GATE_PRE_PAINT = `try{var gp=location.pathname;var gx=${JSON.stringify(GATE_EXEMPT_PREFIXES)};var gs=gp.charAt(0)==="/"&&!/^\\/(api|_next|content|dict)(\\/|$)/.test(gp)&&!/\\.[a-z0-9]+$/i.test(gp)&&!gx.some(function(p){return gp===p||gp.indexOf(p+"/")===0});if(gs&&!localStorage.getItem(${JSON.stringify(LEVELS_MARKER)}))document.documentElement.setAttribute("data-gate","pending");}catch(_){}`;
