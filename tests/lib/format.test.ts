import { describe, expect, it } from "vitest";
import { createFormatters, localeFor } from "@/lib/format";

const EASTERN = /[٠-٩۰-۹]/;

describe("createFormatters: Western digits in both languages (DECISIONS R4)", () => {
  for (const lang of ["ar", "en"] as const) {
    const f = createFormatters(lang);
    it(`${lang}: numbers, percentages and dates use 0-9`, () => {
      expect(f.num(1234567)).toMatch(/^1.234.567$/);
      expect(f.num(3.14159, 2)).toMatch(/^3.14$/);
      expect(f.pct(85)).toBe("85%");
      expect(f.pct(12.5, 1)).toMatch(/^12.5%$/);
      const d = f.date(Date.UTC(2026, 10, 20, 12));
      expect(d).toMatch(/20/);
      expect(d).toMatch(/2026/);
      for (const s of [f.num(9876543210), f.pct(100), d]) expect(s).not.toMatch(EASTERN);
    });
  }
  it("asks for the latn numbering system in Arabic", () => {
    expect(localeFor("ar")).toBe("ar-u-nu-latn");
    expect(new Intl.NumberFormat(localeFor("ar")).resolvedOptions().numberingSystem).toBe("latn");
  });
  it("keeps zero fraction digits by default", () => {
    expect(createFormatters("ar").num(7.6)).toBe("8");
  });
});
