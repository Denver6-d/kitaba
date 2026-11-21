"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RecordingCredit } from "@/data/audio-schema";
import type { PlayWord } from "@/data/play-word";
import type { CefrLevel } from "@/domain/model";
import { playbackRate, playWithFallback, pronounceSource, type Accent } from "@/lib/pronounce";
import { useSpeech } from "@/lib/speech";
import { getAudioLibrary } from "./audio-library";

/**
 * Speaks game words: the word's audio file when there is one, otherwise the
 * device's Web Speech voice (lib/pronounce.ts). The current game's levels are
 * loaded when it mounts, and its words' files are prefetched one at a time,
 * so the whole game plays without waiting, and offline once started.
 */
export function usePronunciation(words: ReadonlyMap<string, PlayWord>) {
  const speech = useSpeech();
  const { accent, speak, status } = speech;
  const [fileAccent, setFileAccent] = useState<Accent | null>(null);
  /** Bumped when indexes load, so `hasFile` is read again. */
  const [loadedVersion, setLoadedVersion] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const levels = useMemo(() => [...new Set([...words.values()].map((w) => w.level))].sort() as CefrLevel[], [words]);
  const levelsKey = levels.join(",");

  useEffect(() => {
    let alive = true;
    const lib = getAudioLibrary();
    void (async () => {
      const m = await lib.manifest();
      if (!alive || !m) return;
      setFileAccent(m.accent);
      if (m.accent !== accent) return;
      await Promise.all(levels.map((l) => lib.loadLevel(l)));
      if (!alive) return;
      setLoadedVersion((v) => v + 1);
      for (const w of words.values()) {
        if (!alive) return;
        if (lib.entry(w.id, w.level)) await lib.url(w.id, w.level);
      }
    })();
    return () => {
      alive = false;
    };
    // levelsKey stands for `levels`; `words` only matters through its levels and is read when the effect runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelsKey, accent]);

  useEffect(
    () => () => {
      audioRef.current?.pause();
    },
    [],
  );

  const hasFile = useCallback(
    (wordId: string): boolean => {
      void loadedVersion;
      const w = words.get(wordId);
      return Boolean(w && fileAccent === accent && getAudioLibrary().entry(w.id, w.level));
    },
    [words, fileAccent, accent, loadedVersion],
  );

  const credit = useCallback(
    (wordId: string): RecordingCredit | null => {
      const w = words.get(wordId);
      return w && hasFile(wordId) ? (getAudioLibrary().entry(w.id, w.level)?.credit ?? null) : null;
    },
    [words, hasFile],
  );

  const stopFile = () => audioRef.current?.pause();

  /** Says `text`; when it is the word `wordId` and that word has a file, plays the file. */
  const say = useCallback(
    (text: string, wordId?: string, rate = 0.9): void => {
      const w = wordId ? words.get(wordId) : undefined;
      const source = pronounceSource({ text, word: w?.word ?? "", accent, fileAccent, hasFile: Boolean(w && hasFile(w.id)), speechReady: status === "ready" });
      if (source !== "file" || !w) {
        stopFile();
        if (source === "speech") speak(text, rate);
        return;
      }
      void playWithFallback(
        async () => {
          const url = await getAudioLibrary().url(w.id, w.level);
          if (!url) return false;
          if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
          const a = (audioRef.current ??= new Audio());
          a.pause();
          a.src = url;
          // Loading a new source resets playbackRate to defaultPlaybackRate: set both.
          const r = playbackRate(rate);
          a.defaultPlaybackRate = r;
          a.playbackRate = r;
          a.preservesPitch = true;
          await a.play();
          return true;
        },
        () => speak(text, rate),
      );
    },
    [words, accent, fileAccent, hasFile, status, speak],
  );

  /** True when this item's text can be spoken one way or the other. */
  const canSay = useCallback((text: string, wordId?: string) => pronounceSource({ text, word: (wordId && words.get(wordId)?.word) || "", accent, fileAccent, hasFile: Boolean(wordId && hasFile(wordId)), speechReady: status === "ready" }) !== "none", [words, accent, fileAccent, hasFile, status]);

  return { ...speech, say, canSay, hasFile, credit };
}
