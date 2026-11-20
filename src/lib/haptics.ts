/**
 * Optional vibration (DESIGN.md V3, "Sound and haptics"). On by default (DECISIONS M5), and
 * only where the browser supports `navigator.vibrate` (Android browsers; iOS
 * Safari has none). Patterns stay short so they never feel like an alert.
 */
export type HapticKind = "correct" | "wrong" | "star";

export const HAPTIC_PATTERNS: Readonly<Record<HapticKind, number | readonly number[]>> = {
  correct: 12,
  wrong: [28, 40, 28],
  star: 16,
};

export function canVibrate(nav: Pick<Navigator, "vibrate"> | undefined = typeof navigator === "undefined" ? undefined : navigator): boolean {
  return typeof nav?.vibrate === "function";
}

export function vibrate(kind: HapticKind, nav: Pick<Navigator, "vibrate"> | undefined = typeof navigator === "undefined" ? undefined : navigator): void {
  if (!nav || !canVibrate(nav)) return;
  try {
    const p = HAPTIC_PATTERNS[kind];
    nav.vibrate(typeof p === "number" ? p : [...p]);
  } catch {
    // Vibration is optional.
  }
}
