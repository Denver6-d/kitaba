import { describe, expect, it } from "vitest";
import { pickEnglishVoice, voiceQuality } from "@/lib/speech";

/** The on-device voice used for words and dictation (DECISIONS D11, V6, DT2). */

const v = (name: string, lang: string, localService = true, isDefault = false) => ({ name, lang, localService, default: isDefault });

describe("voiceQuality", () => {
  it("marks eSpeak and the macOS novelty voices as hard to understand", () => {
    for (const n of ["eSpeak English", "espeak-ng en-us", "Fred", "Zarvox", "Bad News", "Whisper", "Albert"]) expect(voiceQuality(n), n).toBe(0);
  });
  it("prefers enhanced, premium and neural voices", () => {
    for (const n of ["Samantha (Enhanced)", "Ava (Premium)", "Some Neural Voice"]) expect(voiceQuality(n), n).toBe(2);
    for (const n of ["Samantha", "Microsoft Zira - English (United States)", "English United States"]) expect(voiceQuality(n), n).toBe(1);
  });
});

describe("pickEnglishVoice", () => {
  it("never picks a network voice (D11)", () => {
    expect(pickEnglishVoice([v("Google US English", "en-US", false)])).toBeNull();
  });
  it("prefers the requested accent, then the other one, then any English", () => {
    const voices = [v("Daniel", "en-GB"), v("Karen", "en-AU"), v("Samantha", "en-US")];
    expect(pickEnglishVoice(voices, "us")?.name).toBe("Samantha");
    expect(pickEnglishVoice(voices, "uk")?.name).toBe("Daniel");
    expect(pickEnglishVoice([v("Karen", "en-AU"), v("Daniel", "en-GB")], "us")?.name).toBe("Daniel");
  });
  it("picks the clearer voice within an accent, ahead of the device default", () => {
    const voices = [v("Samantha", "en-US", true, true), v("Ava (Enhanced)", "en-US")];
    expect(pickEnglishVoice(voices, "us")?.name).toBe("Ava (Enhanced)");
    expect(pickEnglishVoice([v("Alex", "en-US"), v("Samantha", "en-US", true, true)], "us")?.name).toBe("Samantha");
  });
  it("avoids a hard-to-understand voice even in the requested accent, but uses one when it is all there is", () => {
    expect(pickEnglishVoice([v("Fred", "en-US", true, true), v("Daniel", "en-GB")], "us")?.name).toBe("Daniel");
    expect(pickEnglishVoice([v("eSpeak English (America)", "en-US")], "us")?.name).toBe("eSpeak English (America)");
  });
  it("ignores voices that are not English", () => {
    expect(pickEnglishVoice([v("Maged", "ar-SA"), v("Thomas", "fr-FR")])).toBeNull();
  });
});
