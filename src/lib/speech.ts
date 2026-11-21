"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useHydrated } from "./use-hydrated";
import { useSettings } from "./settings-store";

export type SpeechStatus = "checking" | "ready" | "no-voice" | "unsupported";
export type Accent = "us" | "uk";

const ACCENT_RE: Record<Accent, RegExp> = { us: /^en[-_]US/i, uk: /^en[-_]GB/i };

/**
 * Voices that are hard to understand: eSpeak (robotic formant synthesis) and
 * the old macOS character and novelty voices. Used only when nothing else exists.
 */
const LOW_QUALITY_RE =
  /espeak|\b(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|fred|good news|hysterical|jester|junior|kathy|organ|princess|ralph|superstar|trinoids|whisper|wobble|zarvox)\b/i;
/** The better on-device voices: Apple's downloaded "Enhanced"/"Premium" ones and neural voices. */
const HIGH_QUALITY_RE = /\b(enhanced|premium|neural|natural)\b/i;

/** 0: hard to understand, 1: ordinary, 2: one of the clearer voices. */
export function voiceQuality(name: string): 0 | 1 | 2 {
  if (LOW_QUALITY_RE.test(name)) return 0;
  return HIGH_QUALITY_RE.test(name) ? 2 : 1;
}

/**
 * Picks the clearest on-device English voice (DECISIONS DT2): first any voice
 * that is not hard to understand, then the requested accent (en-US or en-GB),
 * the other one, any other English; within those, the clearer voices, then the
 * device default. Network voices (voice.localService === false, e.g. Chrome's
 * "Google US English") are skipped on purpose: they send the text to a
 * third-party server (DECISIONS D11).
 */
export function pickEnglishVoice<V extends Pick<SpeechSynthesisVoice, "lang" | "localService" | "default" | "name">>(
  voices: readonly V[],
  accent: Accent = "us",
): V | null {
  const local = voices.filter((v) => v.localService && /^en([-_]|$)/i.test(v.lang));
  const other: Accent = accent === "us" ? "uk" : "us";
  const key = (v: V) => {
    const q = voiceQuality(v.name ?? "");
    return [q === 0 ? 1 : 0, ACCENT_RE[accent].test(v.lang) ? 0 : ACCENT_RE[other].test(v.lang) ? 1 : 2, 2 - q, v.default ? 0 : 1];
  };
  const cmp = (a: V, b: V) => {
    const ka = key(a);
    const kb = key(b);
    for (let i = 0; i < ka.length; i += 1) if (ka[i] !== kb[i]) return (ka[i] ?? 0) - (kb[i] ?? 0);
    return 0;
  };
  return [...local].sort(cmp)[0] ?? null;
}

/** Which accent a voice speaks, for the "using the other accent" notice. */
export function voiceAccent(lang: string): Accent | "other" {
  if (ACCENT_RE.us.test(lang)) return "us";
  if (ACCENT_RE.uk.test(lang)) return "uk";
  return "other";
}

const supported = () => typeof window !== "undefined" && "speechSynthesis" in window;

function subscribeVoices(cb: () => void): () => void {
  if (!supported()) return () => {};
  window.speechSynthesis.addEventListener("voiceschanged", cb);
  return () => window.speechSynthesis.removeEventListener("voiceschanged", cb);
}

/** Shared across mounts so each new word does not wait again. */
let waitedOnce = false;

export function useSpeech() {
  const hydrated = useHydrated();
  const [settings] = useSettings();
  const accent = settings.accent;
  // A stable string ("uri|lang") is a safe external-store snapshot.
  const voiceKey = useSyncExternalStore(
    subscribeVoices,
    () => {
      if (!supported()) return "";
      const v = pickEnglishVoice(window.speechSynthesis.getVoices(), accent);
      return v ? `${v.voiceURI}|${v.lang}` : "";
    },
    () => "",
  );
  const [waited, setWaited] = useState(waitedOnce);

  // Some browsers never fire voiceschanged when there are no voices: stop waiting after 1.5 s.
  useEffect(() => {
    if (waitedOnce) return;
    const id = window.setTimeout(() => {
      waitedOnce = true;
      setWaited(true);
    }, 1500);
    return () => window.clearTimeout(id);
  }, []);
  useEffect(
    () => () => {
      if (supported()) window.speechSynthesis.cancel();
    },
    [],
  );

  const sep = voiceKey.indexOf("|");
  const voiceUri = sep === -1 ? "" : voiceKey.slice(0, sep);
  const voiceLang = sep === -1 ? "" : voiceKey.slice(sep + 1);
  const status: SpeechStatus = !hydrated ? "checking" : !supported() ? "unsupported" : voiceUri ? "ready" : waited ? "no-voice" : "checking";

  const speak = useCallback(
    /**
     * Speaks with the on-device voice, stopping whatever was playing; false
     * when there is none. Several texts are queued as separate utterances, one
     * per sentence: some engines cut a long single utterance short.
     */
    (text: string | readonly string[], rate = 0.9): boolean => {
      if (!supported() || !voiceUri) return false;
      const synth = window.speechSynthesis;
      const voice = synth.getVoices().find((v) => v.voiceURI === voiceUri);
      if (!voice) return false;
      synth.cancel();
      for (const part of typeof text === "string" ? [text] : text) {
        if (!part.trim()) continue;
        const u = new SpeechSynthesisUtterance(part);
        u.voice = voice;
        u.lang = voice.lang;
        u.rate = rate;
        synth.speak(u);
      }
      return true;
    },
    [voiceUri],
  );

  /** Stops any speech, including queued sentences. */
  const stop = useCallback(() => {
    if (supported()) window.speechSynthesis.cancel();
  }, []);

  const spoken = voiceLang ? voiceAccent(voiceLang) : null;
  return { status, speak, stop, accent, usingOtherAccent: spoken !== null && spoken !== accent };
}
