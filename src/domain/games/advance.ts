/**
 * How a game moves on after an answer on touch devices (DECISIONS M9), pure.
 *
 * On a phone the answer field used to stay focused after Check, so the
 * keyboard covered the result, and any input event in the feedback phase
 * (a keystroke, a suggestion-bar tap, or the keyboard re-committing its
 * composing word after the field was emptied) counted as "start typing to
 * continue" and skipped the result. Next also appears where Check was, so a
 * double tap on Check reached Next.
 *
 * On touch devices:
 *  - typing never advances, and nothing typed during feedback is carried
 *    into the next word: Next (or Enter on a hardware keyboard) is the only
 *    way on;
 *  - a tap on the action bar that lands within SETTLE_MS of the bar changing
 *    (the verdict appearing, or the next word) is ignored, so a double tap
 *    cannot check and continue, or continue and answer the next word.
 * With a mouse and a keyboard nothing changes.
 */

/** Long enough for an accidental second tap (Android's double-tap window is 300 ms), short enough not to be noticed. */
export const SETTLE_MS = 450;

/** Typing during feedback moves on: desktop only. */
export function typingAdvances(touch: boolean, advanceRequested: boolean): boolean {
  return !touch && advanceRequested;
}

/** Letters typed during feedback start the next answer: desktop only. */
export function carriesIntoNext(touch: boolean): boolean {
  return !touch;
}

/**
 * True when a tap on the action bar should be ignored: on a touch device, a
 * pointer press that began less than SETTLE_MS after the bar last changed.
 * Keyboard activation (Enter, Space) is never a tap and is never ignored.
 */
export function tapTooSoon(opts: { touch: boolean; keyboard: boolean; changedAt: number | null; pressedAt: number }): boolean {
  const { touch, keyboard, changedAt, pressedAt } = opts;
  if (!touch || keyboard || changedAt === null) return false;
  const since = pressedAt - changedAt;
  return since >= 0 && since < SETTLE_MS;
}
