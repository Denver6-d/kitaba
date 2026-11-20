import type { Settings } from "./settings";
import { hasUserActivation } from "./user-activation";
import { playTone, type ToneKind } from "./sound";
import { vibrate, type HapticKind } from "./haptics";

export type FeedbackKind = "correct" | "wrong" | "star" | "cleared";

/** What a game event triggers, given the learner's settings. Pure, so the defaults are testable. */
export function feedbackFor(kind: FeedbackKind, settings: Pick<Settings, "sounds" | "haptics">): { tone: ToneKind | null; haptic: HapticKind | null } {
  return {
    tone: settings.sounds ? kind : null,
    haptic: settings.haptics && kind !== "cleared" ? kind : null,
  };
}

/**
 * Plays the sound and/or vibration for an event, unless the learner turned them off. Nothing
 * plays before the learner has interacted with the page (browser autoplay rules); a game
 * only reaches its first sound through a tap or a key, so this is a safety net.
 */
export function giveFeedback(kind: FeedbackKind, settings: Pick<Settings, "sounds" | "haptics">, step = 0): void {
  if (!hasUserActivation()) return;
  const f = feedbackFor(kind, settings);
  if (f.tone) playTone(f.tone, step);
  if (f.haptic) vibrate(f.haptic);
}
