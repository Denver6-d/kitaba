import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { DEFAULT_SETTINGS, motionAllowed, parseSettings, PRE_PAINT_SCRIPT, SETTINGS_KEY } from "@/lib/settings";
import { feedbackFor } from "@/lib/feedback";
import { hasUserActivation } from "@/lib/user-activation";
import { canVibrate, HAPTIC_PATTERNS, vibrate } from "@/lib/haptics";
import { TONES } from "@/lib/sound";

describe("entry fade-ups respect reduced motion (DESIGN.md V3, motion)", () => {
  it("run only for full motion, or system without the OS setting", () => {
    expect(motionAllowed("system", false)).toBe(true);
    expect(motionAllowed("system", true)).toBe(false);
    expect(motionAllowed("reduce", false)).toBe(false);
    expect(motionAllowed("full", true)).toBe(true);
  });
  function prePaint(stored: Record<string, unknown>, osReduce: boolean) {
    const el = { lang: "", dir: "", dataset: {} as Record<string, string>, style: { setProperty: () => undefined }, setAttribute: () => undefined };
    runInNewContext(PRE_PAINT_SCRIPT, {
      localStorage: { getItem: (k: string) => (k === SETTINGS_KEY ? JSON.stringify(stored) : null) },
      document: { documentElement: el },
      location: { pathname: "/welcome" },
      matchMedia: () => ({ matches: osReduce }),
    });
    return el.dataset.reveal;
  }
  it("the pre-paint script marks the page before first paint with the same rule", () => {
    expect(prePaint({}, false)).toBe("on");
    expect(prePaint({}, true)).toBeUndefined();
    expect(prePaint({ motion: "reduce" }, false)).toBeUndefined();
    expect(prePaint({ motion: "full" }, true)).toBe("on");
  });
});

describe("sounds and haptics (on by default, DECISIONS M5)", () => {
  it("are both on in the default settings and for settings saved before the toggles existed", () => {
    expect(DEFAULT_SETTINGS.sounds).toBe(true);
    expect(DEFAULT_SETTINGS.haptics).toBe(true);
    expect(parseSettings(JSON.stringify({ lang: "en" }))).toMatchObject({ sounds: true, haptics: true });
  });
  it("keep a learner's saved choice, on or off", () => {
    expect(parseSettings(JSON.stringify({ sounds: false, haptics: false }))).toMatchObject({ sounds: false, haptics: false });
    expect(parseSettings(JSON.stringify({ sounds: false }))).toMatchObject({ sounds: false, haptics: true });
    expect(parseSettings(JSON.stringify({ sounds: true, haptics: false }))).toMatchObject({ sounds: true, haptics: false });
  });
  it("play nothing before the learner has interacted with the page (autoplay rules)", () => {
    expect(hasUserActivation({ userActivation: { hasBeenActive: false } })).toBe(false);
    expect(hasUserActivation({ userActivation: { hasBeenActive: true } })).toBe(true);
    expect(hasUserActivation({})).toBe(true);
  });
  it("trigger the event's tone and vibration by default, and nothing once turned off", () => {
    for (const kind of ["correct", "wrong", "star"] as const) expect(feedbackFor(kind, DEFAULT_SETTINGS)).toEqual({ tone: kind, haptic: kind });
    for (const kind of ["correct", "wrong", "star", "cleared"] as const) expect(feedbackFor(kind, { sounds: false, haptics: false })).toEqual({ tone: null, haptic: null });
    expect(feedbackFor("star", { sounds: true, haptics: false })).toEqual({ tone: "star", haptic: null });
    expect(feedbackFor("wrong", { sounds: false, haptics: true })).toEqual({ tone: null, haptic: "wrong" });
    expect(feedbackFor("cleared", { sounds: true, haptics: true }).haptic).toBeNull();
  });
  it("vibrate only where navigator.vibrate exists, with short patterns", () => {
    expect(canVibrate(undefined)).toBe(false);
    expect(canVibrate({} as Navigator)).toBe(false);
    const nav = { vibrate: vi.fn(() => true) };
    vibrate("wrong", nav);
    expect(nav.vibrate).toHaveBeenCalledWith([28, 40, 28]);
    for (const p of Object.values(HAPTIC_PATTERNS)) expect([p].flat().reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(120);
  });
  it("are synthesised tones (frequencies), not audio files", () => {
    for (const notes of Object.values(TONES)) for (const [f] of notes) expect(f).toBeGreaterThan(100);
  });
});

describe("fade-up CSS (DECISIONS R21, R25)", () => {
  const css = readFileSync(new URL("../../src/app/globals.css", import.meta.url), "utf8");
  it("runs the 3 s safety reveal only until the first Reveal mounts, so scroll fade-ups still play later", () => {
    expect(css).toMatch(/html\[data-reveal\]:not\(\[data-reveal-ready\]\) \[data-reveal-item\]:not\(\[data-shown\]\) \{\s*animation: reveal-safety/);
    expect(css).not.toMatch(/html\[data-reveal\] \[data-reveal-item\]:not\(\[data-shown\]\) \{[^}]*reveal-safety/);
  });
  it("hides nothing unless html[data-reveal] is set (reduced motion and no-script show everything)", () => {
    const hiding = [...css.matchAll(/([^{}]+)\{[^{}]*\bopacity: 0;/g)].map((m) => m[1]!.trim()).filter((s) => s.includes("reveal"));
    for (const selector of hiding) expect(selector, selector).toMatch(/^html\[data-reveal\]/);
  });
});
