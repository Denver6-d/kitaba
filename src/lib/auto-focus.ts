/**
 * Automatic focus into a text field (DECISIONS M7).
 *
 * On a touch device (primary pointer coarse), focusing a text field opens the
 * on-screen keyboard, which covers the screen while the learner is still
 * listening to the word. There the app never moves focus into a text field on
 * its own: the learner taps the field when ready. With a mouse or trackpad the
 * field keeps its automatic focus, so typing can start at once.
 *
 * Focus on buttons (choice items, Next) is unaffected: it opens no keyboard and
 * keeps keyboard and screen-reader users in place.
 */

export const COARSE_POINTER_QUERY = "(pointer: coarse)";

type MatchMedia = (query: string) => { readonly matches: boolean };

function defaultMatchMedia(): MatchMedia | null {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia.bind(window) : null;
}

/** True unless the primary pointer is coarse (a phone or tablet). Unknown environments keep focus. */
export function mayAutoFocusText(matchMedia: MatchMedia | null = defaultMatchMedia()): boolean {
  if (!matchMedia) return true;
  try {
    return !matchMedia(COARSE_POINTER_QUERY).matches;
  } catch {
    return true;
  }
}

/** Focuses a text field automatically, except on touch devices. */
export function autoFocusText(el: HTMLElement | null | undefined, options?: FocusOptions, matchMedia?: MatchMedia | null): void {
  if (el && mayAutoFocusText(matchMedia === undefined ? defaultMatchMedia() : matchMedia)) el.focus(options);
}
