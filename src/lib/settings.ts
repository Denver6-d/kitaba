import { z } from "zod";

/**
 * Per-device preferences. Stored in localStorage (not synced) because they
 * must be applied before first paint by the inline script in the root layout.
 */
export const settingsSchema = z.object({
  lang: z.enum(["ar", "en"]).catch("ar"),
  theme: z.enum(["system", "light", "dark"]).catch("system"),
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
  const dark = s.theme === "dark" || (s.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  el.dataset.theme = dark ? "dark" : "light";
  el.dataset.font = s.readableFont ? "readable" : "default";
  el.dataset.motion = s.motion;
  el.style.setProperty("--text-scale", String(s.textScale));
}

/**
 * Runs before React hydrates so the first paint already has the right
 * direction, theme and text size (no flash). Kept dependency-free on purpose.
 */
export const PRE_PAINT_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(
  SETTINGS_KEY,
)})||"{}");var e=document.documentElement;var l=s.lang==="en"?"en":"ar";e.lang=l;e.dir=l==="ar"?"rtl":"ltr";var t=s.theme==="dark"||s.theme==="light"?s.theme:"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);e.dataset.theme=d?"dark":"light";e.dataset.font=s.readableFont===true?"readable":"default";e.dataset.motion=s.motion==="reduce"||s.motion==="full"?s.motion:"system";var x=Number(s.textScale);if(x>=0.9&&x<=1.4)e.style.setProperty("--text-scale",String(x));}catch(_){}})();`;

/** True when motion should be reduced (OS setting or manual override). */
export function prefersReducedMotion(): boolean {
  if (typeof document === "undefined") return true;
  const m = document.documentElement.dataset.motion;
  if (m === "reduce") return true;
  if (m === "full") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
