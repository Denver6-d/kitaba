/**
 * How a word is spoken (DECISIONS "Pronunciation audio"), pure and tested.
 *
 * 1. The word's audio file (a human recording or the offline neural voice),
 *    when the text to speak is the word itself, a file exists, and the file's
 *    accent is the learner's accent (only American files exist so far, so a
 *    learner who chose British keeps the device's British voice).
 * 2. Otherwise the device's Web Speech voice, when one is ready.
 * 3. Otherwise nothing (the game shows its no-voice fallback).
 * Sentences ("in a sentence", homophones, dictation) always use Web Speech.
 */

export type Accent = "us" | "uk";
export type PronounceSource = "file" | "speech" | "none";

export interface PronounceInput {
  /** The text to speak. */
  readonly text: string;
  /** The word the file would say. */
  readonly word: string;
  readonly accent: Accent;
  /** The accent of the audio files, or null when they are unavailable. */
  readonly fileAccent: Accent | null;
  /** A file exists for this word (its level's index is loaded and lists it). */
  readonly hasFile: boolean;
  readonly speechReady: boolean;
}

const norm = (s: string) => s.trim().toLowerCase();

export function pronounceSource(i: PronounceInput): PronounceSource {
  if (i.hasFile && i.fileAccent === i.accent && norm(i.text) === norm(i.word)) return "file";
  return i.speechReady ? "speech" : "none";
}

/** Web Speech rates used by the game (0.9 normal, 0.85 after an answer, 0.6 slower). */
export const SLOW_SPEECH_RATE = 0.6;
/** "Slower" for a recording: slower, with its pitch kept (HTMLMediaElement.preservesPitch). */
export const SLOW_PLAYBACK_RATE = 0.7;

/** The playback rate of a file for a Web Speech rate: recordings already speak at a natural pace. */
export function playbackRate(speechRate: number): number {
  return speechRate <= SLOW_SPEECH_RATE + 0.05 ? SLOW_PLAYBACK_RATE : 1;
}

/**
 * Plays the file, and speaks with Web Speech instead when the file is missing
 * or fails (network, decoding, autoplay refusal). Resolves to what was used.
 */
export async function playWithFallback(playFile: () => Promise<boolean>, speak: () => boolean): Promise<PronounceSource> {
  try {
    if (await playFile()) return "file";
  } catch {
    // fall through to Web Speech
  }
  return speak() ? "speech" : "none";
}
