import { describe, expect, it } from "vitest";
import { buildTestText, CUSTOM_TEXT_MAX, sanitizeCustomText, segmentAt } from "@/domain/typing/text";
import { seededRng } from "@/domain/shared/random";

describe("sanitizeCustomText", () => {
  it("keeps printable English and collapses whitespace and newlines", () => {
    expect(sanitizeCustomText("Hello,\n\n  world!\t")).toEqual({ text: "Hello, world!", stripped: false, tooLong: false });
  });
  it("replaces curly quotes and dashes with ASCII equivalents", () => {
    expect(sanitizeCustomText("It’s “great” — really…").text).toBe('It\'s "great" - really...');
  });
  it("strips Arabic and other non-ASCII characters and reports it", () => {
    const r = sanitizeCustomText("Hello مرحبا world ✓");
    expect(r.text).toBe("Hello world");
    expect(r.stripped).toBe(true);
  });
  it(`flags text longer than ${CUSTOM_TEXT_MAX} characters`, () => {
    expect(sanitizeCustomText("a".repeat(CUSTOM_TEXT_MAX + 1)).tooLong).toBe(true);
    expect(sanitizeCustomText("a".repeat(CUSTOM_TEXT_MAX)).tooLong).toBe(false);
  });
  it("returns empty text for whitespace-only input", () => {
    expect(sanitizeCustomText("   \n ").text).toBe("");
  });
});

describe("buildTestText", () => {
  const items = [
    { id: "s1", text: "I am here." },
    { id: "s2", text: "You are there." },
    { id: "s3", text: "We go now." },
  ];

  it("joins items with single spaces until the minimum length is reached", () => {
    const r = buildTestText(items, 40, seededRng(1));
    expect(r.text.length).toBeGreaterThanOrEqual(40);
    expect(r.text).not.toMatch(/\s{2}/);
    expect(r.segments[0]?.start).toBe(0);
  });

  it("records segments so the UI can show each item's meaning", () => {
    const r = buildTestText(items, 30, seededRng(2));
    for (const s of r.segments) {
      expect(r.text.slice(s.start, s.end)).toBe(items.find((i) => i.id === s.id)?.text);
    }
    const first = r.segments[0];
    expect(first && segmentAt(r.segments, first.start)?.id).toBe(first?.id);
    expect(segmentAt(r.segments, 99_999)).toBeUndefined();
  });

  it("does not repeat an item back to back", () => {
    const r = buildTestText(items, 200, seededRng(3));
    for (let i = 1; i < r.segments.length; i += 1) {
      expect(r.segments[i]?.id).not.toBe(r.segments[i - 1]?.id);
    }
  });

  it("returns empty text for no items", () => {
    expect(buildTestText([], 10, seededRng(1)).text).toBe("");
  });
});
