import type { Settings } from "./settings";
import { playTone, type ToneKind } from "./sound";
import { vibrate, type HapticKind } from "./haptics";

export type FeedbackKind = "correct" | "wrong" | "star" | "cleared";

/** What a game event triggers, given the learner's settings. Pure, so the "off by default" rule is testable. */
export function feedbackFor(kind: FeedbackKind, settings: Pick<Settings, "sounds" | "haptics">): { tone: ToneKind | null; haptic: HapticKind | null } {
  return {
    tone: settings.sounds ? kind : null,
    haptic: settings.haptics && kind !== "cleared" ? kind : null,
  };
}

/** Plays the sound and/or vibration for an event, if the learner turned them on. */
export function giveFeedback(kind: FeedbackKind, settings: Pick<Settings, "sounds" | "haptics">, step = 0): void {
  const f = feedbackFor(kind, settings);
  if (f.tone) playTone(f.tone, step);
  if (f.haptic) vibrate(f.haptic);
}
