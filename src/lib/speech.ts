"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useHydrated } from "./use-hydrated";
import { useSettings } from "./settings-store";

export type SpeechStatus = "checking" | "ready" | "no-voice" | "unsupported";
export type Accent = "us" | "uk";

const ACCENT_RE: Record<Accent, RegExp> = { us: /^en[-_]US/i, uk: /^en[-_]GB/i };

/**
 * Picks an on-device English voice, preferring the requested accent
 * (en-US or en-GB), then any other English. Network voices
 * (voice.localService === false, e.g. Chrome's "Google US English") are skipped
 * on purpose: they send the text to a third-party server (DECISIONS D11).
 */
export function pickEnglishVoice<V extends Pick<SpeechSynthesisVoice, "lang" | "localService" | "default">>(
  voices: readonly V[],
  accent: Accent = "us",
): V | null {
  const local = voices.filter((v) => v.localService && /^en([-_]|$)/i.test(v.lang));
  const other: Accent = accent === "us" ? "uk" : "us";
  const rank = (v: V) => (ACCENT_RE[accent].test(v.lang) ? 0 : ACCENT_RE[other].test(v.lang) ? 1 : 2) + (v.default ? -0.5 : 0);
  return [...local].sort((a, b) => rank(a) - rank(b))[0] ?? null;
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
    /** Speaks with the on-device voice; false when there is none. */
    (text: string, rate = 0.9): boolean => {
      if (!supported() || !voiceUri) return false;
      const synth = window.speechSynthesis;
      const voice = synth.getVoices().find((v) => v.voiceURI === voiceUri);
      if (!voice) return false;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = rate;
      synth.speak(u);
      return true;
    },
    [voiceUri],
  );

  const spoken = voiceLang ? voiceAccent(voiceLang) : null;
  return { status, speak, accent, usingOtherAccent: spoken !== null && spoken !== accent };
}
