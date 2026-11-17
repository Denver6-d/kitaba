import { describe, expect, it } from "vitest";
import {
  arabicCharToLatin,
  codeToLatin,
  intendedLatin,
  isArabicChar,
  isLatinTypable,
} from "@/domain/typing/layout";

describe("isArabicChar", () => {
  it("detects Arabic letters, Arabic punctuation and presentation forms", () => {
    for (const ch of ["ض", "ا", "ي", "ة", "ء", "،", "؟", "ﻻ"]) {
      expect(isArabicChar(ch)).toBe(true);
    }
  });
  it("rejects Latin letters, digits, spaces and symbols", () => {
    for (const ch of ["a", "Z", "1", " ", ".", "'", "?", "é"]) {
      expect(isArabicChar(ch)).toBe(false);
    }
  });
});

describe("isLatinTypable", () => {
  it("accepts printable ASCII", () => {
    expect(isLatinTypable("a")).toBe(true);
    expect(isLatinTypable("~")).toBe(true);
    expect(isLatinTypable(" ")).toBe(true);
  });
  it("rejects Arabic and control characters", () => {
    expect(isLatinTypable("ب")).toBe(false);
    expect(isLatinTypable("\n")).toBe(false);
  });
});

describe("codeToLatin (physical key → intended US-QWERTY character)", () => {
  it("maps letter keys honouring shift", () => {
    expect(codeToLatin("KeyH", false)).toBe("h");
    expect(codeToLatin("KeyH", true)).toBe("H");
  });
  it("maps digits and punctuation", () => {
    expect(codeToLatin("Digit1", false)).toBe("1");
    expect(codeToLatin("Digit1", true)).toBe("!");
    expect(codeToLatin("Comma", false)).toBe(",");
    expect(codeToLatin("Quote", false)).toBe("'");
    expect(codeToLatin("Slash", true)).toBe("?");
    expect(codeToLatin("Space", false)).toBe(" ");
  });
  it("returns null for unknown or modifier codes", () => {
    expect(codeToLatin("ShiftLeft", false)).toBeNull();
    expect(codeToLatin("", false)).toBeNull();
  });
});

describe("arabicCharToLatin (fallback when event.code is unavailable)", () => {
  it("maps characters of the standard Arabic (101) layout to the same physical key", () => {
    expect(arabicCharToLatin("ض")).toBe("q");
    expect(arabicCharToLatin("ش")).toBe("a");
    expect(arabicCharToLatin("ا")).toBe("h");
    expect(arabicCharToLatin("ئ")).toBe("z");
    expect(arabicCharToLatin("و")).toBe(",");
    expect(arabicCharToLatin("ة")).toBe("m");
  });
  it("returns null for characters that are not on the layout", () => {
    expect(arabicCharToLatin("x")).toBeNull();
  });
});

describe("intendedLatin", () => {
  it("prefers event.code when present", () => {
    expect(intendedLatin("ا", "KeyH", false)).toBe("h");
  });
  it("falls back to the Arabic layout map", () => {
    expect(intendedLatin("ا", undefined, false)).toBe("h");
  });
  it("uses shift with the fallback map for letters", () => {
    expect(intendedLatin("ا", undefined, true)).toBe("H");
  });
});
