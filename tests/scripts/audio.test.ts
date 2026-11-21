import { describe, expect, it } from "vitest";
import { classifyAccentLabel, labelsForFile, speakerAccent } from "../../scripts/audio/lib/accent.mjs";
import { gainDb, parseVolume } from "../../scripts/audio/lib/audio.mjs";
import { authorOf, checkLicense, transcriptionOf } from "../../scripts/audio/lib/license.mjs";
import { lingualibreByWord, prefixedByWord } from "../../scripts/audio/lib/names.mjs";
import { candidatesFor, chooseSources, type FileInfo } from "../../scripts/audio/lib/select.mjs";

/** The audio pipeline's source choice: licences, credits, accents and names (DECISIONS AU4-AU6). */

const meta = (fields: Record<string, string>) => Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, { value: v }]));
const BY_SA_3 = { License: "cc-by-sa-3.0", LicenseShortName: "CC BY-SA 3.0", LicenseUrl: "http://creativecommons.org/licenses/by-sa/3.0/", Artist: '<a href="//commons.wikimedia.org/wiki/User:Dvortygirl">Dvortygirl</a>' };

describe("checkLicense", () => {
  it("allows CC0, CC BY, CC BY-SA (any version) and public domain", () => {
    expect(checkLicense(meta(BY_SA_3))).toMatchObject({ ok: true, short: "CC BY-SA 3.0", url: "https://creativecommons.org/licenses/by-sa/3.0/" });
    expect(checkLicense(meta({ License: "cc-by-4.0", LicenseUrl: "https://creativecommons.org/licenses/by/4.0" }))).toMatchObject({ ok: true, short: "CC BY 4.0" });
    expect(checkLicense(meta({ License: "cc-by-sa-2.5", LicenseUrl: "https://creativecommons.org/licenses/by-sa/2.5" })).ok).toBe(true);
    expect(checkLicense(meta({ License: "cc0" }))).toMatchObject({ ok: true, short: "CC0 1.0" });
    expect(checkLicense(meta({ License: "pd", LicenseShortName: "Public domain" }))).toMatchObject({ ok: true, short: "Public domain" });
  });

  it("refuses non-commercial, no-derivatives, GFDL-only, unknown and restricted files", () => {
    expect(checkLicense(meta({ License: "cc-by-nc-sa-4.0", LicenseUrl: "x" })).ok).toBe(false);
    expect(checkLicense(meta({ License: "cc-by-nd-4.0", LicenseUrl: "x" })).ok).toBe(false);
    expect(checkLicense(meta({ License: "gfdl" })).ok).toBe(false);
    expect(checkLicense(meta({ License: "fal" })).ok).toBe(false);
    expect(checkLicense(meta({})).ok).toBe(false);
    expect(checkLicense(meta({ ...BY_SA_3, Restrictions: "personality" })).ok).toBe(false);
  });

  it("needs a licence link for CC BY and CC BY-SA", () => {
    expect(checkLicense(meta({ License: "cc-by-sa-4.0" })).ok).toBe(false);
  });
});

describe("authorOf and transcriptionOf", () => {
  it("reads the author as plain text", () => {
    expect(authorOf(meta(BY_SA_3))).toBe("Dvortygirl");
    expect(authorOf(meta({ Artist: "No machine-readable author provided. TheDaveRoss assumed (based on copyright claims)." }))).toBe("TheDaveRoss");
    expect(authorOf(meta({ Artist: "User:Dvortygirl" }))).toBe("Dvortygirl");
  });

  it("credits a Lingua Libre speaker, and the recorder when it is someone else", () => {
    expect(authorOf(meta({ Artist: '<ul><li>Speaker: <a href="x">Persent101</a></li>\n<li>Recorder: <a href="y">Persent101</a></li></ul>' }))).toBe("Persent101");
    expect(authorOf(meta({ Artist: "<ul><li>Speaker: Flame, not lame</li><li>Recorder: Flame</li></ul>" }))).toBe("Flame, not lame (recorded by Flame)");
  });

  it("reads a Lingua Libre record's transcription", () => {
    expect(transcriptionOf("{{Lingua Libre record\n | speaker = X\n | transcription = apple\n | qualifier = \n}}")).toBe("apple");
    expect(transcriptionOf("{{Lingua Libre record}}")).toBeNull();
  });
});

describe("accents from Wiktionary labels", () => {
  it("classifies labels", () => {
    for (const l of ["GA", "US", "General American", "GenAm", "North Carolina", "California"]) expect(classifyAccentLabel(l), l).toBe("us");
    for (const l of ["RP", "SSB", "UK", "Southern England", "London"]) expect(classifyAccentLabel(l), l).toBe("uk");
    for (const l of ["AU", "Canada", "India", "Ireland"]) expect(classifyAccentLabel(l), l).toBe("other");
    expect(classifyAccentLabel("")).toBeNull();
    expect(classifyAccentLabel("weird")).toBeNull();
  });

  it("finds the labels of one file in an entry", () => {
    const text = "** {{audio|en|LL-Q1860 (eng)-Vealhurl-apple.wav|a=Southern England}}\n** {{audio|en|En-us-apple.ogg|a=GA}}\n** {{audio|en|En-uk-apple.ogg|a=SSB, RP}}";
    expect(labelsForFile(text, "LL-Q1860 (eng)-Vealhurl-apple.wav")).toEqual(["Southern England"]);
    expect(labelsForFile(text, "En-uk-apple.ogg")).toEqual(["SSB", "RP"]);
    expect(labelsForFile(text, "LL-Q1860_(eng)-Vealhurl-apple.wav")).toEqual(["Southern England"]);
    expect(labelsForFile(text, "missing.ogg")).toEqual([]);
  });

  it("decides a speaker only on enough, consistent evidence", () => {
    expect(speakerAccent(["us", "us", "us"])).toBe("us");
    expect(speakerAccent(["us", "us"])).toBeNull(); // too few
    expect(speakerAccent(["us", "uk", "us", "uk"])).toBeNull(); // mixed
    expect(speakerAccent(["uk", "uk", "uk", "uk", "us"])).toBe("uk"); // 80%
  });
});

describe("names", () => {
  const words = new Set(["apple", "well-known", "known"]);
  it("matches En-us files exactly, case-sensitively", () => {
    const m = prefixedByWord([{ name: "En-us-apple.ogg" }, { name: "En-us-Apple.ogg" }, { name: "En-us-apples.ogg" }, { name: "En-us-apple.jpg" }], "En-us-", words);
    expect(m.get("apple")).toEqual(["En-us-apple.ogg"]);
    expect(m.size).toBe(1);
  });

  it("matches Lingua Libre files whose speaker name has hyphens", () => {
    const m = lingualibreByWord([{ name: "LL-Q1860 (eng)-Back ache-apple.wav" }, { name: "LL-Q1860 (eng)-X-well-known.wav" }], words);
    expect(m.get("apple")).toEqual([{ speaker: "Back ache", name: "LL-Q1860 (eng)-Back ache-apple.wav" }]);
    // Ambiguous: both readings are listed; only a known speaker is ever used.
    expect(m.get("well-known")?.[0]?.speaker).toBe("X");
    expect(m.get("known")?.[0]?.speaker).toBe("X-well");
  });
});

describe("chooseSources", () => {
  const info = (files: Record<string, Partial<FileInfo> & { meta: FileInfo["meta"] }>) => (t: string) => {
    const f = files[t];
    return f ? { url: `https://upload.example/${t}`, page: `https://commons.wikimedia.org/wiki/${t}`, ...f } : undefined;
  };

  it("orders En-us files first, then known American Lingua Libre speakers only", () => {
    const c = candidatesFor("apple", {
      enUs: new Map([["apple", ["En-us-apple.wav", "En-us-apple.ogg"]]]),
      lingualibre: new Map([
        [
          "apple",
          [
            { speaker: "Unknown", name: "LL-Q1860 (eng)-Unknown-apple.wav" },
            { speaker: "British", name: "LL-Q1860 (eng)-British-apple.wav" },
            { speaker: "American", name: "LL-Q1860 (eng)-American-apple.wav" },
          ],
        ],
      ]),
      speakerAccent: (s) => ({ British: "uk", American: "us" })[s] ?? null,
      speakerRank: () => 0,
    });
    expect(c.map((x) => x.title)).toEqual(["File:En-us-apple.ogg", "File:En-us-apple.wav", "File:LL-Q1860 (eng)-American-apple.wav"]);
  });

  it("skips files with a refused licence, a wrong transcription, an odd length or a vandalised author", () => {
    const { usable, rejected } = chooseSources(
      "apple",
      [
        { title: "File:a.ogg", kind: "en-us" },
        { title: "File:b.ogg", kind: "en-us" },
        { title: "File:c.wav", kind: "lingualibre" },
        { title: "File:d.ogg", kind: "en-us" },
        { title: "File:e.wav", kind: "lingualibre" },
        { title: "File:f.ogg", kind: "en-us" },
      ],
      info({
        "File:a.ogg": { meta: meta({ License: "cc-by-nc-4.0", LicenseUrl: "x" }) },
        "File:b.ogg": { meta: meta(BY_SA_3), duration: 12 },
        "File:c.wav": { meta: meta(BY_SA_3), wikitext: "{{Lingua Libre record\n|transcription = apples\n}}" },
        "File:d.ogg": { meta: meta({ ...BY_SA_3, Artist: "stalker of someone and someone found out Dvortygirl" }) },
        "File:e.wav": { meta: meta(BY_SA_3), wikitext: "{{Lingua Libre record}}" },
        "File:f.ogg": { meta: meta(BY_SA_3), duration: 0.8 },
      }),
    );
    expect(usable.map((u) => u.title)).toEqual(["File:e.wav", "File:f.ogg"]);
    expect(rejected.map((r) => r.title)).toEqual(["File:a.ogg", "File:b.ogg", "File:c.wav", "File:d.ogg"]);
    expect(usable[1]).toMatchObject({ author: "Dvortygirl", license: "CC BY-SA 3.0" });
  });

  it("has no usable file when nothing qualifies (the word then gets the generated voice)", () => {
    expect(chooseSources("apple", [], () => undefined).usable).toEqual([]);
  });
});

describe("loudness", () => {
  const out = "[Parsed_volumedetect_0 @ 0] n_samples: 0\n[Parsed_volumedetect_0 @ 1] n_samples: 11025\n[Parsed_volumedetect_0 @ 1] mean_volume: -26.5 dB\n[Parsed_volumedetect_0 @ 1] max_volume: -9.0 dB\n";
  it("reads ffmpeg's volumedetect", () => {
    expect(parseVolume(out)).toEqual({ mean: -26.5, max: -9, samples: 11025 });
    expect(parseVolume("mean_volume: -inf dB\nmax_volume: -inf dB")).toBeNull();
  });

  it("raises speech to the target without letting the peak pass the ceiling", () => {
    expect(gainDb({ mean: -26.5, max: -9 })).toBe(6.5);
    expect(gainDb({ mean: -30, max: -3 })).toBe(2); // limited by the peak
    expect(gainDb({ mean: -12, max: 0 })).toBe(-8); // too loud: turned down
  });
});
