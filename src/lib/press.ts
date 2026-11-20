/**
 * A press on a button that moves before the release (DECISIONS M2).
 *
 * The browser fires `click` on a button only when the press and the release
 * land on that same button. After Check, the game's "Next" can move under a
 * still pointer: the review note arrives a moment later and pushes it down,
 * the button shrinks slightly while pressed, and on phones the sticky bar
 * follows the keyboard. The release then lands beside the button, the click
 * goes to an ancestor, and nothing happens, while focus stays in the answer
 * field. This rule decides whether such a press still counts: the pointer
 * itself barely moved, the press was recent, and it was for the same item.
 */

export interface Press {
  readonly itemKey: string;
  readonly x: number;
  readonly y: number;
  /** Event time stamp in ms. */
  readonly t: number;
}

/** How far the pointer may travel between press and release (a finger's natural slop). */
export const PRESS_SLOP_PX = 12;
/** A press held longer than this is not a tap. */
export const PRESS_MAX_MS = 1500;

export function pressActivates(press: Press | null, release: { readonly x: number; readonly y: number; readonly t: number }, currentItemKey: string | null): boolean {
  if (!press || currentItemKey === null || press.itemKey !== currentItemKey) return false;
  const dt = release.t - press.t;
  if (dt < 0 || dt > PRESS_MAX_MS) return false;
  return Math.hypot(release.x - press.x, release.y - press.y) <= PRESS_SLOP_PX;
}
