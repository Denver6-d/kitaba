import { Atkinson_Hyperlegible_Mono, Cairo, Hanken_Grotesk, Lexend, Literata } from "next/font/google";

/** Fonts are self-hosted by next/font at build time: no runtime requests to Google. */

export const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
});

export const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
});

export const literata = Literata({
  subsets: ["latin"],
  variable: "--font-literata",
  display: "swap",
  axes: ["opsz"],
  preload: false,
});

export const atkinsonMono = Atkinson_Hyperlegible_Mono({
  subsets: ["latin"],
  variable: "--font-atkinson-mono",
  display: "swap",
  preload: false,
  // No metric overrides exist for this family; fall back to the platform monospace.
  adjustFontFallback: false,
  fallback: ["ui-monospace", "Menlo", "Consolas", "monospace"],
});

/** Only downloaded when the reading-friendly font setting is on. */
export const lexend = Lexend({
  subsets: ["latin"],
  variable: "--font-lexend",
  display: "swap",
  preload: false,
});

export const fontVariables = [cairo, hanken, literata, atkinsonMono, lexend].map((f) => f.variable).join(" ");
