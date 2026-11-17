/**
 * Optional feedback tones synthesised with Web Audio (no audio files). Off by
 * default; the AudioContext is only created after the learner enables sounds.
 */
let ctx: AudioContext | null = null;

const NOTES = { correct: [660, 990], wrong: [220, 196], cleared: [523, 784] } as const;

export function playTone(kind: keyof typeof NOTES): void {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    const [a, b] = NOTES[kind];
    const t = ctx.currentTime;
    [a, b].forEach((freq, i) => {
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = t + i * 0.09;
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.045, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.2);
    });
  } catch {
    // Audio is optional.
  }
}
