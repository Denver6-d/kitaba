import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { autoFocusText, COARSE_POINTER_QUERY, mayAutoFocusText } from "@/lib/auto-focus";

/**
 * No automatic focus into a text field on touch devices (DECISIONS M7): the
 * keyboard would cover the word while it is spoken. The suite has no DOM
 * library (R25), so the rule is tested on the pure helper, and the wiring by
 * reading the sources.
 */

const media = (coarse: boolean) => vi.fn((q: string) => ({ matches: q === COARSE_POINTER_QUERY && coarse }));
const field = () => ({ focus: vi.fn() }) as unknown as HTMLElement & { focus: ReturnType<typeof vi.fn> };

describe("mayAutoFocusText", () => {
  it("keeps automatic focus with a mouse or trackpad (fine pointer)", () => {
    expect(mayAutoFocusText(media(false))).toBe(true);
  });
  it("gives no automatic focus on a touch device (coarse pointer)", () => {
    const mm = media(true);
    expect(mayAutoFocusText(mm)).toBe(false);
    expect(mm).toHaveBeenCalledWith("(pointer: coarse)");
  });
  it("keeps focus where it cannot tell (no matchMedia, or it throws)", () => {
    expect(mayAutoFocusText(null)).toBe(true);
    expect(
      mayAutoFocusText(() => {
        throw new Error("no");
      }),
    ).toBe(true);
  });
});

describe("autoFocusText", () => {
  it("focuses the field on desktop, with the options given", () => {
    const el = field();
    autoFocusText(el, { preventScroll: true }, media(false));
    expect(el.focus).toHaveBeenCalledWith({ preventScroll: true });
  });
  it("does not focus the field on a phone", () => {
    const el = field();
    autoFocusText(el, undefined, media(true));
    expect(el.focus).not.toHaveBeenCalled();
  });
  it("ignores a missing field", () => {
    expect(() => autoFocusText(null, undefined, media(false))).not.toThrow();
  });
});

const src = (p: string) => readFileSync(new URL(`../../src/${p}`, import.meta.url), "utf8");

describe("every answer field goes through the rule", () => {
  // Every game mode and review run in GameSession; the landing mini game has its own field.
  const files = ["features/games/game-session.tsx", "features/landing/mini-game.tsx", "components/spelling-input.tsx"];

  it("never focuses an answer field directly, nor with the native autoFocus attribute", () => {
    for (const f of files) {
      const s = src(f);
      expect(s, f).not.toMatch(/(inputRef|inner)\.current\?\.focus\(/);
      expect(s, f).not.toMatch(/<input[^>]*\bautoFocus=/s);
      expect(s, f).not.toMatch(/^\s*autoFocus=\{autoFocus\}/m);
    }
  });

  it("uses the helper at each place the game focused the field automatically", () => {
    const game = src("features/games/game-session.tsx");
    // After the hint reveal, on Next, and on Start (timed modes).
    expect(game.match(/autoFocusText\(inputRef\.current/g)?.length).toBe(3);
    expect(src("features/landing/mini-game.tsx")).toMatch(/autoFocusText\(inputRef\.current/);
    expect(src("components/spelling-input.tsx")).toMatch(/if \(autoFocus\) autoFocusText\(inner\.current\)/);
  });

  it("releases the field on Next on a touch device, so the keyboard closes over the new word", () => {
    // goNext computes `touch` once (M9) and releases the field with it.
    const game = src("features/games/game-session.tsx");
    expect(game).toMatch(/const goNext = useCallback\(\(\) => \{[\s\S]*?const touch = !mayAutoFocusText\(\);[\s\S]*?if \(touch\) inputRef\.current\?\.blur\(\);/);
  });

  it("keeps the keyboard inset on the field (unchanged)", () => {
    expect(src("components/spelling-input.tsx")).toMatch(/visualViewport/);
    expect(src("features/games/game-session.tsx")).toMatch(/useKeyboardInset\(\)/);
  });

  it("the placement test has no text field to focus (choices only)", () => {
    const s = src("features/levels/placement-test.tsx");
    expect(s).not.toMatch(/<input|<textarea|SpellingInput/);
  });
});
