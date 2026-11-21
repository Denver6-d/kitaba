import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONTENT_BASE, CONTENT_CACHE } from "@/features/library/library";
import { AUDIO_BASE, AUDIO_CACHE } from "@/features/audio/audio-library";
import { ar } from "@/i18n/ar";
import { en } from "@/i18n/en";
import { SCOWL_NOTICE, VARCON_NOTICE, CMUDICT_NOTICE, DICTIONARY_EN_NOTICE } from "@/data/credits/notices.generated";
import { varconNotice } from "../../scripts/content/07-notices.mjs";

/** How the library is wired into the app (DECISIONS OD13–OD14). */

const sw = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? sources(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}
const SRC = sources(new URL("../../src", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

describe("the source scan itself", () => {
  it("finds the app sources (so the scans below are not vacuous)", () => {
    expect(SRC.length).toBeGreaterThan(50);
  });
});

describe("service worker and loader agree", () => {
  it("use the same content cache and path, and keep the cache across deploys", () => {
    expect(sw).toContain(`const CONTENT_CACHE = "${CONTENT_CACHE}"`);
    expect(sw).toContain(`const CONTENT_PREFIX = "${CONTENT_BASE}"`);
    expect(sw).toMatch(/const LONG_LIVED = \[CONTENT_CACHE, AUDIO_CACHE\]/);
    expect(sw).toMatch(/k !== VERSION && !LONG_LIVED\.includes\(k\)/);
  });
  it("use the same audio cache and path as the pronunciation loader", () => {
    expect(sw).toContain(`const AUDIO_CACHE = "${AUDIO_CACHE}"`);
    expect(sw).toContain(`const AUDIO_PREFIX = "${AUDIO_BASE}"`);
  });
  it("precaches the credits page with the other pages", () => {
    expect(sw).toMatch(/"\/credits"/);
  });
});

describe("no content counts on the site", () => {
  it("has no word or sentence count in the copy", () => {
    for (const dict of [ar, en] as const) {
      expect("factWords" in dict.home).toBe(false);
      // Thresholds such as "at least 5 words" are rules, not totals: a total has three or more digits.
      expect(JSON.stringify(dict)).not.toMatch(/\d{1,3}(,\d{3})+\s*(words|sentences)|\d{3,}\s*(words|sentences|كلمة|جملة)/);
    }
  });
  it("never renders the size of a content list", () => {
    for (const file of SRC) {
      if (!file.includes(`${join("src", "app")}`) && !file.includes(`${join("src", "features")}`) && !file.includes(`${join("src", "components")}`)) continue;
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/\b(spellingWords|dictationSentences|dictationMessages|scenarios|sentencesAt\([^)]*\)|wordsAt\([^)]*\))\.length\b/);
    }
  });
  it("keeps the library out of the bundle: no source file imports public/content", () => {
    for (const file of SRC) expect(readFileSync(file, "utf8"), file).not.toMatch(/(from|import\()\s*["'`][^"'`]*(public\/content|content\/v1)/);
  });
});

describe("licence notices", () => {
  it("reproduces each notice with its copyright lines", () => {
    expect(SCOWL_NOTICE).toMatch(/Copyright 2000-2018 by Kevin Atkinson/);
    expect(SCOWL_NOTICE).toMatch(/WordNet/);
    expect(VARCON_NOTICE).toMatch(/Copyright 2016 by Benjamin Titze/);
    expect(VARCON_NOTICE).toMatch(/Geoff Kuenning/);
    expect(CMUDICT_NOTICE).toMatch(/Carnegie Mellon University/);
    expect(DICTIONARY_EN_NOTICE).toMatch(/MIT|Permission/);
  });
  it("cuts the VarCon README at its Copyright section", () => {
    expect(varconNotice("Intro\n\nCopyright\n=========\n\nCopyright 2016 by Someone\n")).toBe("Copyright 2016 by Someone");
  });
});
