import { describe, expect, it } from "vitest";
import { playbackRate, playWithFallback, pronounceSource, SLOW_PLAYBACK_RATE, SLOW_SPEECH_RATE, type PronounceInput } from "@/lib/pronounce";

/** Which source speaks a word, and the fallback to Web Speech (DECISIONS AU9). */

const base: PronounceInput = { text: "apple", word: "apple", accent: "us", fileAccent: "us", hasFile: true, speechReady: true };

describe("pronounceSource", () => {
  it("prefers the word's file", () => {
    expect(pronounceSource(base)).toBe("file");
    expect(pronounceSource({ ...base, speechReady: false })).toBe("file");
  });

  it("ignores case and surrounding spaces when matching the word", () => {
    expect(pronounceSource({ ...base, text: " Apple " })).toBe("file");
  });

  it("uses Web Speech when the word has no file", () => {
    expect(pronounceSource({ ...base, hasFile: false })).toBe("speech");
  });

  it("uses Web Speech for sentences, even when the word has a file", () => {
    expect(pronounceSource({ ...base, text: "I ate an apple." })).toBe("speech");
  });

  it("keeps the learner's accent: no American file for a British learner", () => {
    expect(pronounceSource({ ...base, accent: "uk" })).toBe("speech");
    expect(pronounceSource({ ...base, fileAccent: null })).toBe("speech");
  });

  it("is none when there is neither a file nor a voice", () => {
    expect(pronounceSource({ ...base, hasFile: false, speechReady: false })).toBe("none");
    expect(pronounceSource({ ...base, text: "A sentence.", speechReady: false })).toBe("none");
  });
});

describe("playbackRate", () => {
  it("plays a recording at its own pace, and slower for the slower button", () => {
    expect(playbackRate(0.9)).toBe(1);
    expect(playbackRate(0.85)).toBe(1);
    expect(playbackRate(SLOW_SPEECH_RATE)).toBe(SLOW_PLAYBACK_RATE);
    expect(SLOW_PLAYBACK_RATE).toBeLessThan(1);
  });
});

describe("playWithFallback", () => {
  it("plays the file and does not speak", async () => {
    let spoke = false;
    expect(await playWithFallback(async () => true, () => (spoke = true))).toBe("file");
    expect(spoke).toBe(false);
  });

  it("speaks when the file is missing", async () => {
    let spoke = false;
    expect(await playWithFallback(async () => false, () => (spoke = true))).toBe("speech");
    expect(spoke).toBe(true);
  });

  it("speaks when the file fails to play (network, decoding, autoplay refusal)", async () => {
    let spoke = false;
    const failing = async (): Promise<boolean> => {
      throw new DOMException("not allowed", "NotAllowedError");
    };
    expect(await playWithFallback(failing, () => (spoke = true))).toBe("speech");
    expect(spoke).toBe(true);
  });

  it("is none when the file fails and there is no voice", async () => {
    expect(await playWithFallback(async () => false, () => false)).toBe("none");
  });
});
