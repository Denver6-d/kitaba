import { IBM_Plex_Sans_Arabic, Inter, Lexend } from "next/font/google";

/** Fonts are self-hosted by next/font at build time: no runtime requests to Google. */

/** Arabic UI (DESIGN.md V3). Light 300 for headings, 400–600 for text and controls. */
export const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-plex-arabic",
  display: "swap",
});

/** English words, the English UI and every Latin string inside the Arabic UI. */
export const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

/** Only downloaded when the reading-friendly font setting is on. */
export const lexend = Lexend({
  subsets: ["latin"],
  variable: "--font-lexend",
  display: "swap",
  preload: false,
});

export const fontVariables = [plexArabic, inter, lexend].map((f) => f.variable).join(" ");
