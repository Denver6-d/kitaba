"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useHydrated } from "./use-hydrated";

export type SpeechStatus = "checking" | "ready" | "no-voice" | "unsupported";

/**
 * Picks an on-device English voice. Network voices (voice.localService === false,
 * e.g. Chrome's "Google US English") are skipped on purpose: they send the text
 * to a third-party server, and Kitaba makes no network calls besides Supabase.
 */
export function pickEnglishVoice(voices: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const local = voices.filter((v) => v.localService && /^en([-_]|$)/i.test(v.lang));
  const rank = (v: SpeechSynthesisVoice) => (/en[-_]US/i.test(v.lang) ? 0 : /en[-_]GB/i.test(v.lang) ? 1 : 2) + (v.default ? -0.5 : 0);
  return [...local].sort((a, b) => rank(a) - rank(b))[0] ?? null;
}

const supported = () => typeof window !== "undefined" && "speechSynthesis" in window;

function subscribeVoices(cb: () => void): () => void {
  if (!supported()) return () => {};
  window.speechSynthesis.addEventListener("voiceschanged", cb);
  return () => window.speechSynthesis.removeEventListener("voiceschanged", cb);
}

/** The chosen voice's URI (a stable string, safe as an external-store snapshot). */
const voiceUriSnapshot = () => (supported() ? (pickEnglishVoice(window.speechSynthesis.getVoices())?.voiceURI ?? "") : "");

export function useSpeech() {
  const hydrated = useHydrated();
  const voiceUri = useSyncExternalStore(subscribeVoices, voiceUriSnapshot, () => "");
  const [waited, setWaited] = useState(false);

  // Some browsers never fire voiceschanged when there are no voices: stop waiting after 1.5 s.
  useEffect(() => {
    const id = window.setTimeout(() => setWaited(true), 1500);
    return () => {
      window.clearTimeout(id);
      if (supported()) window.speechSynthesis.cancel();
    };
  }, []);

  const status: SpeechStatus = !hydrated ? "checking" : !supported() ? "unsupported" : voiceUri ? "ready" : waited ? "no-voice" : "checking";

  const speak = useCallback(
    (text: string, rate = 0.9) => {
      if (!supported() || !voiceUri) return;
      const synth = window.speechSynthesis;
      const voice = synth.getVoices().find((v) => v.voiceURI === voiceUri);
      if (!voice) return;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = rate;
      synth.speak(u);
    },
    [voiceUri],
  );

  return { status, speak };
}
