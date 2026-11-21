/**
 * Whether a game session is on screen (DECISIONS M9). The phone's bottom
 * navigation hides while one is, wherever the session runs: /play/game, and
 * the review session that opens in place on /review. Before M7 and M9 the open
 * keyboard hid the navigation while a learner typed in review; with the
 * keyboard now closed until the field is tapped and again at Check, the
 * navigation covered the game's Check and Next bar there.
 *
 * A counter, not a boolean, so two sessions mounting and unmounting in any
 * order never leave it wrong.
 */
let active = 0;
const listeners = new Set<() => void>();

const emit = () => {
  for (const l of listeners) l();
};

/** Marks a game session as on screen; call the returned function when it leaves. */
export function enterGame(): () => void {
  active++;
  emit();
  let left = false;
  return () => {
    if (left) return;
    left = true;
    active = Math.max(0, active - 1);
    emit();
  };
}

export const isGameActive = (): boolean => active > 0;

export function subscribeGameActive(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
