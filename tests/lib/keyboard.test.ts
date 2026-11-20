import { describe, expect, it } from "vitest";
import { keyboardInset } from "@/lib/keyboard";

describe("keyboardInset (input and Check stay above the phone keyboard)", () => {
  it("is the part of the layout the keyboard covers (iOS: the layout does not shrink)", () => {
    expect(keyboardInset(844, { height: 508, offsetTop: 0, scale: 1 })).toBe(336);
  });
  it("accounts for a visual viewport scrolled within the layout", () => {
    expect(keyboardInset(844, { height: 508, offsetTop: 100, scale: 1 })).toBe(236);
  });
  it("is 0 when the layout already shrank (Android resizes-content) or only the URL bar moved", () => {
    expect(keyboardInset(508, { height: 508, offsetTop: 0, scale: 1 })).toBe(0);
    expect(keyboardInset(844, { height: 790, offsetTop: 0, scale: 1 })).toBe(0);
  });
  it("is 0 while the page is pinch-zoomed, and without visualViewport", () => {
    expect(keyboardInset(844, { height: 400, offsetTop: 0, scale: 2 })).toBe(0);
    expect(keyboardInset(844, null)).toBe(0);
  });
});
