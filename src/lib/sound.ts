/**
 * Key-click sound synthesised with Web Audio (no audio files). Off by default;
 * the AudioContext is only created after the user enables sounds and types.
 */
let ctx: AudioContext | null = null;

export function playClick(kind: "key" | "error" = "key"): void {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = kind === "key" ? "triangle" : "sine";
    osc.frequency.setValueAtTime(kind === "key" ? 1900 : 240, t);
    osc.frequency.exponentialRampToValueAtTime(kind === "key" ? 900 : 180, t + 0.03);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(kind === "key" ? 0.05 : 0.04, t + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + (kind === "key" ? 0.035 : 0.08));
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.09);
  } catch {
    // Audio is optional.
  }
}
