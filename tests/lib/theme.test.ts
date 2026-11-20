import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CANVAS, GOLD } from "@/config/theme";
import { DEFAULT_SETTINGS, parseSettings, PRE_PAINT_SCRIPT } from "@/lib/settings";

const css = readFileSync(new URL("../../src/app/globals.css", import.meta.url), "utf8");
const root = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));
const token = (name: string): string => {
  const m = root.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\b`));
  if (!m?.[1]) throw new Error(`token --${name} not found`);
  return m[1].toUpperCase();
};

/** WCAG 2.x relative luminance and contrast ratio. */
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};

describe("design tokens (DESIGN.md V3)", () => {
  it("are the owner-approved values", () => {
    expect(token("canvas")).toBe("#0B110F");
    expect(token("surface")).toBe("#121A17");
    expect(token("raised")).toBe("#16201C");
    expect(token("fg")).toBe("#E8ECE9");
    expect(token("fg-2")).toBe("#A9B4AF");
    expect(token("fg-3")).toBe("#9AA5A0");
    expect(token("gold")).toBe("#E2B657");
    expect(token("gold-hover")).toBe("#F0CB78");
    expect(token("on-gold")).toBe("#17140B");
    expect(token("mint")).toBe("#E9F1EC");
    expect(token("on-mint")).toBe("#13201A");
    expect(token("on-mint-2")).toBe("#33463D");
    expect(token("mint-label")).toBe("#6A5214");
    expect(token("error")).toBe("#F2A27E");
    expect(root).toContain("--line: rgb(232 236 233 / 0.08)");
  });

  it("every text colour passes WCAG AA (4.5:1) on every background it is used on", () => {
    const pairs: [string, string][] = [];
    for (const fg of ["fg", "fg-2", "fg-3", "gold", "error"]) for (const bg of ["canvas", "surface", "raised"]) pairs.push([fg, bg]);
    pairs.push(["on-gold", "gold"], ["on-gold", "gold-hover"], ["on-mint", "mint"], ["on-mint-2", "mint"], ["mint-label", "mint"]);
    for (const [fg, bg] of pairs) expect(contrast(token(fg), token(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  });

  it("the TypeScript copies (viewport, manifest, icon) match the CSS", () => {
    expect(CANVAS).toBe(token("canvas"));
    expect(GOLD).toBe(token("gold"));
    const icon = readFileSync(new URL("../../public/icon.svg", import.meta.url), "utf8").toUpperCase();
    expect(icon).toContain(`FILL="${CANVAS}"`);
    expect(icon).toContain(`FILL="${GOLD}"`);
  });
});

describe("dark only (DECISIONS R1)", () => {
  it("declares color-scheme dark and has no light theme or theme switch left", () => {
    expect(root).toContain("color-scheme: dark");
    expect(css).not.toMatch(/data-theme|prefers-color-scheme|color-scheme: light/);
    expect(PRE_PAINT_SCRIPT).not.toMatch(/theme|prefers-color-scheme/);
    expect(Object.keys(DEFAULT_SETTINGS)).not.toContain("theme");
  });
  it("ignores a theme stored by an older version", () => {
    const s = parseSettings(JSON.stringify({ theme: "light", lang: "en" }));
    expect(s.lang).toBe("en");
    expect(s).not.toHaveProperty("theme");
  });
});
