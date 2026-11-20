import { z } from "zod";
import { GATE_PRE_PAINT } from "./first-visit";

/**
 * Per-device preferences. Stored in localStorage (not synced) because they
 * must be applied before first paint by the inline script in the root layout.
 */
export const settingsSchema = z.object({
  lang: z.enum(["ar", "en"]).catch("ar"),
  textScale: z.number().min(0.9).max(1.4).catch(1),
  readableFont: z.boolean().catch(false),
  motion: z.enum(["system", "reduce", "full"]).catch("system"),
  /** Optional feedback tones; off by default. */
  sounds: z.boolean().catch(false),
  /** American or British English: sets the voice and the expected spelling (DECISIONS V6). */
  accent: z.enum(["us", "uk"]).catch("us"),
});

export type Settings = z.infer<typeof settingsSchema>;
export type Lang = Settings["lang"];

export const DEFAULT_SETTINGS: Settings = settingsSchema.parse({});
export const SETTINGS_KEY = "kitaba:settings";
export const TEXT_SCALES = [0.9, 1, 1.1, 1.2, 1.3, 1.4] as const;

export function parseSettings(raw: string | null): Settings {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return settingsSchema.parse(JSON.parse(raw));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Applies settings to <html>. Mirrors the inline pre-paint script below. */
export function applySettingsToDocument(s: Settings, doc: Document = document): void {
  const el = doc.documentElement;
  el.lang = s.lang;
  el.dir = s.lang === "ar" ? "rtl" : "ltr";
  el.dataset.font = s.readableFont ? "readable" : "default";
  el.dataset.motion = s.motion;
  el.style.setProperty("--text-scale", String(s.textScale));
}

/**
 * Runs before React hydrates so the first paint already has the right
 * direction and text size (no flash), and hides the page of a first
 * visit until the level check has run (lib/first-visit.ts). Kept dependency-free on purpose.
 */
export const PRE_PAINT_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(
  SETTINGS_KEY,
)})||"{}");var e=document.documentElement;var l=s.lang==="en"?"en":"ar";e.lang=l;e.dir=l==="ar"?"rtl":"ltr";e.dataset.font=s.readableFont===true?"readable":"default";e.dataset.motion=s.motion==="reduce"||s.motion==="full"?s.motion:"system";var x=Number(s.textScale);if(x>=0.9&&x<=1.4)e.style.setProperty("--text-scale",String(x));}catch(_){}${GATE_PRE_PAINT}})();`;

/** True when motion should be reduced (OS setting or manual override). */
export function prefersReducedMotion(): boolean {
  if (typeof document === "undefined") return true;
  const m = document.documentElement.dataset.motion;
  if (m === "reduce") return true;
  if (m === "full") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
