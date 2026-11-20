/**
 * Optional feedback tones synthesised with Web Audio (no audio files, no
 * dependency). On by default (DECISIONS M5); the AudioContext is only created
 * when a game plays its first tone, which always follows a tap or a key.
 */
let ctx: AudioContext | null = null;

export type ToneKind = "correct" | "wrong" | "cleared" | "star";

/** Each tone is a few short sine notes: [frequency in Hz, start offset in s]. */
export const TONES: Readonly<Record<ToneKind, readonly (readonly [number, number])[]>> = {
  correct: [
    [660, 0],
    [990, 0.08],
  ],
  wrong: [
    [233, 0],
    [196, 0.1],
  ],
  cleared: [
    [523, 0],
    [784, 0.09],
  ],
  // One bright note; each further star is a step higher (see `step`).
  star: [[880, 0]],
};

/** Plays a tone. `step` raises a star by a fourth per star (0, 1, 2). */
export function playTone(kind: ToneKind, step = 0): void {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    const t = ctx.currentTime;
    const lift = 2 ** ((5 * step) / 12);
    for (const [freq, offset] of TONES[kind]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = t + offset;
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq * lift, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.045, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.2);
    }
  } catch {
    // Audio is optional.
  }
}
