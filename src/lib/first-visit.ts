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

/**
 * localStorage key set once this device has seen levels (choice, placement,
 * skip, or real progress). It is never removed, not even when progress is
 * deleted from the device or on sign-out: the level screen is shown once per
 * device (DECISIONS L2).
 */
export const LEVELS_MARKER = "kitaba:levels-set";

/** Remembers that this device has levels; storage errors are ignored. */
export function rememberLevels(): void {
  try {
    localStorage.setItem(LEVELS_MARKER, "1");
  } catch {
    // Storage blocked: the page is simply shown after the check each time.
  }
}

/** True when this device has had levels before (see LEVELS_MARKER). */
export function hasLevelsMarker(): boolean {
  try {
    return localStorage.getItem(LEVELS_MARKER) !== null;
  } catch {
    return false;
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

/** What /welcome was opened for: `retake=1` (Settings, manual only) or `test=1` (start with the test). */
export function welcomeIntent(params: { get(name: string): string | null }): { readonly retake: boolean; readonly test: boolean } {
  const retake = params.get("retake") === "1";
  return { retake, test: retake || params.get("test") === "1" };
}

/** The same /welcome address without `test` and `retake` (null when there is nothing to remove), so a reload never restarts the test. */
export function welcomeUrlWithoutIntent(href: string): string | null {
  const url = new URL(href);
  if (!url.searchParams.has("test") && !url.searchParams.has("retake")) return null;
  url.searchParams.delete("test");
  url.searchParams.delete("retake");
  return `${url.pathname}${url.search}${url.hash}`;
}

export interface LevelCheckInput {
  /**
   * The profile's levelSource, read from local data AFTER the latest local
   * change (a sync pull included); undefined while that read is pending;
   * "error" if it could not be read.
   */
  readonly levelSource: string | null | undefined | "error";
  /** Real progress is stored (reviews, games, writing…): an old account without the level flag. */
  readonly hasProgress: boolean;
  /** This device has had levels before (LEVELS_MARKER). */
  readonly deviceMarker: boolean;
  readonly accountReady: boolean;
  readonly signedIn: boolean;
  /** The first sync's status for a signed-in learner (levels may be in the account). */
  readonly syncStatus: string | null;
  /** True once the safety wait ran out. */
  readonly timedOut: boolean;
}

/** "known": never ask; "unknown": ask once (the level screen); "wait": local data or the first pull is still loading. */
export type LevelCheck = "wait" | "known" | "unknown";

/**
 * Does this learner still need the level screen? (DECISIONS L2.) Asks only when
 * it is certain: local data has been read, a signed-in learner's first pull has
 * finished, and there is no level, no progress and no device marker. Any doubt
 * (storage error, sync error, offline, the safety wait) means "do not ask".
 */
export function levelCheck(i: LevelCheckInput): LevelCheck {
  if (i.levelSource === "error") return "known";
  if (i.levelSource === undefined) return i.timedOut ? "known" : "wait";
  if (i.levelSource !== null || i.hasProgress || i.deviceMarker) return "known";
  if (!i.accountReady) return i.timedOut ? "known" : "wait";
  if (!i.signedIn) return "unknown";
  // The account may hold levels from another device: only a finished pull can say it does not.
  if (i.syncStatus === "synced") return "unknown";
  if (i.syncStatus === "offline" || i.syncStatus === "error") return "known";
  return i.timedOut ? "known" : "wait";
}

export interface GateInput extends LevelCheckInput {
  readonly pathname: string;
  /** False when IndexedDB is unavailable (private mode): progress is not kept, so never insist. */
  readonly persistent: boolean;
}

export type GateDecision = "wait" | "show" | "welcome";

/** The gate's action on a page, given the level check. */
export function gateFor(pathname: string, persistent: boolean, check: LevelCheck): GateDecision {
  if (!shouldGate(pathname) || !persistent) return "show";
  return check === "wait" ? "wait" : check === "known" ? "show" : "welcome";
}

export function gateDecision(g: GateInput): GateDecision {
  return gateFor(g.pathname, g.persistent, levelCheck(g));
}

/**
 * The part that runs before first paint (inlined into PRE_PAINT_SCRIPT): hide
 * <main> on a gated page when this browser has never stored levels.
 */
export const GATE_PRE_PAINT = `try{var gp=location.pathname;var gx=${JSON.stringify(GATE_EXEMPT_PREFIXES)};var gs=gp.charAt(0)==="/"&&!/^\\/(api|_next|content|dict)(\\/|$)/.test(gp)&&!/\\.[a-z0-9]+$/i.test(gp)&&!gx.some(function(p){return gp===p||gp.indexOf(p+"/")===0});if(gs&&!localStorage.getItem(${JSON.stringify(LEVELS_MARKER)}))document.documentElement.setAttribute("data-gate","pending");}catch(_){}`;
