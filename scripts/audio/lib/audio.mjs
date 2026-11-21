/**
 * Audio processing through the portable ffmpeg and piper in tools/ (dev-only).
 * Arguments are passed as arrays, never through a shell.
 *
 * Every file, human or generated, goes through the same chain:
 *   1. decode, mono, 22,050 Hz, a 70 Hz high-pass (rumble), and silence trimmed
 *      at both ends down to a short margin; the loudness is measured;
 *   2. a gain that brings the speech to TARGET_DB RMS without letting the peak
 *      pass CEILING_DB, then MP3 at BITRATE (mono), no tags.
 * Files whose trimmed length is not a single word's (SECONDS) are refused.
 */
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

export const SAMPLE_RATE = 22050;
export const BITRATE = "32k";
/** RMS loudness of the trimmed speech, in dBFS (about -19 LUFS for speech). */
export const TARGET_DB = -20;
/** Highest peak after the gain, in dBFS. */
export const CEILING_DB = -1;
/** Silence kept before and after the word, in seconds. */
export const MARGIN = 0.06;
/** A single spoken word, after trimming. */
export const SECONDS = { min: 0.2, max: 2.6 };
const THRESHOLD = "-42dB";

/** mean_volume and max_volume from ffmpeg's volumedetect output; null when absent. */
export function parseVolume(stderr) {
  const mean = /mean_volume:\s*(-?[\d.]+|-inf) dB/.exec(stderr)?.[1];
  const max = /max_volume:\s*(-?[\d.]+|-inf) dB/.exec(stderr)?.[1];
  const samples = /n_samples:\s*(\d+)/g;
  let n = 0;
  for (const m of stderr.matchAll(samples)) n = Math.max(n, Number(m[1]));
  if (mean === undefined || max === undefined || mean === "-inf") return null;
  return { mean: Number(mean), max: Number(max), samples: n };
}

/** The gain (dB) that brings the RMS to the target while the peak stays under the ceiling. */
export function gainDb({ mean, max }, target = TARGET_DB, ceiling = CEILING_DB) {
  return Math.round(Math.min(target - mean, ceiling - max) * 10) / 10;
}

function ff(ffmpeg, args) {
  const r = spawnSync(ffmpeg, ["-hide_banner", "-nostdin", "-y", ...args], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  return { ok: r.status === 0, stderr: r.stderr ?? "" };
}

/**
 * Decodes `input`, trims, normalises and writes `out` (MP3).
 * @returns {{ ok: true, seconds: number, gain: number } | { ok: false, reason: string }}
 */
export function toMp3(ffmpeg, input, out, tmpWav) {
  const trim = `silenceremove=start_periods=1:start_silence=${MARGIN}:start_threshold=${THRESHOLD}:detection=rms`;
  const pass1 = ff(ffmpeg, ["-i", input, "-vn", "-ac", "1", "-ar", String(SAMPLE_RATE), "-af", `aresample=${SAMPLE_RATE},aformat=channel_layouts=mono,highpass=f=70,${trim},areverse,${trim},areverse,volumedetect`, "-c:a", "pcm_s16le", tmpWav]);
  if (!pass1.ok) return { ok: false, reason: "could not decode" };
  const v = parseVolume(pass1.stderr);
  if (!v || v.samples === 0) {
    rmSync(tmpWav, { force: true });
    return { ok: false, reason: "silent" };
  }
  const seconds = v.samples / SAMPLE_RATE;
  if (seconds < SECONDS.min || seconds > SECONDS.max) {
    rmSync(tmpWav, { force: true });
    return { ok: false, reason: `trimmed length ${seconds.toFixed(2)} s` };
  }
  const gain = gainDb(v);
  const pass2 = ff(ffmpeg, ["-i", tmpWav, "-af", `volume=${gain}dB`, "-ac", "1", "-ar", String(SAMPLE_RATE), "-c:a", "libmp3lame", "-b:a", BITRATE, "-map_metadata", "-1", "-id3v2_version", "0", "-write_xing", "0", "-f", "mp3", out]);
  rmSync(tmpWav, { force: true });
  if (!pass2.ok) return { ok: false, reason: "could not encode" };
  return { ok: true, seconds, gain };
}

/**
 * Synthesises each { text, file } with piper in one process (the model loads
 * once). Returns the files that were written.
 */
export function synthesize(piper, model, jobs) {
  if (!jobs.length) return [];
  const input = jobs.map((j) => JSON.stringify({ text: j.text, output_file: j.file })).join("\n") + "\n";
  const r = spawnSync(piper, ["--model", model, "--json-input", "--sentence_silence", "0"], { input, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`piper failed: ${(r.stderr ?? "").slice(-500)}`);
  return jobs.map((j) => j.file);
}
