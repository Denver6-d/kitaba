import type { GameState } from "./engine";

/**
 * When a timed round's clock starts (DECISIONS M8), pure.
 *
 * With a mouse, Start starts the clock and focuses the field, so typing can
 * begin at once. On a touch device the app does not focus the field (M7), so
 * the learner first taps it: Start only opens the round (the first word is
 * shown and spoken) and the clock starts with the first keystroke. The time
 * spent tapping the field is not counted.
 */
export type ClockStart = "on-start" | "on-first-key";

export const clockStartFor = (touch: boolean): ClockStart => (touch ? "on-first-key" : "on-start");

/** Answer-input events that count as the first keystroke (an IME composition starts typing too). */
const TYPING_EVENTS = new Set(["keydown", "change", "compositionstart"]);

/** True when this input event should start a timed round's clock: it is typing, and the clock has not started. */
export function startsClockOnInput(s: Pick<GameState, "startedAt" | "finishedAt" | "config">, eventType: string): boolean {
  return s.config.durationMs !== null && s.startedAt === null && s.finishedAt === null && TYPING_EVENTS.has(eventType);
}
