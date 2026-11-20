import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LetterBoxes } from "@/features/games/ui/letter-boxes";
import { pressActivates, PRESS_MAX_MS, PRESS_SLOP_PX, type Press } from "@/lib/press";

/** Fixes from the owner's manual test (DECISIONS M1, M2). */

const boxes = (value: string) => {
  const html = renderToStaticMarkup(createElement(LetterBoxes, { value }));
  return { html, count: (html.match(/<span/g) ?? []).length };
};

describe("letter boxes (M1)", () => {
  it("shows exactly one box per typed letter, with no empty box after the last one", () => {
    // Seen in "complete the word": __ght -> right showed 5 letters plus an empty dashed box.
    const { html, count } = boxes("right");
    expect(count).toBe(5);
    expect(html).not.toContain("dashed");
  });
  it("shows nothing before the first letter, so the word's length is never hinted", () => {
    expect(boxes("").count).toBe(0);
    expect(boxes("ab").count).toBe(2);
  });
});

describe("Next after Check (M2)", () => {
  const press: Press = { itemKey: "i3", x: 200, y: 700, t: 1000 };

  it("counts a release at the same point even though the button moved under it", () => {
    // Regression: the review note arrived after the press and pushed Next 55 px down, so the
    // release landed beside it, the click went to an ancestor and the game stayed on the word.
    expect(pressActivates(press, { x: 200, y: 700, t: 1080 }, "i3")).toBe(true);
    expect(pressActivates(press, { x: 200 + PRESS_SLOP_PX - 1, y: 700, t: 1080 }, "i3")).toBe(true);
  });
  it("counts the exact slop and time limits, and nothing past them or before the press", () => {
    expect(pressActivates(press, { x: 200 + PRESS_SLOP_PX, y: 700, t: 1000 + PRESS_MAX_MS }, "i3")).toBe(true);
    expect(pressActivates(press, { x: 200 + PRESS_SLOP_PX + 0.5, y: 700, t: 1080 }, "i3")).toBe(false);
    expect(pressActivates(press, { x: 200, y: 700, t: 999 }, "i3")).toBe(false);
  });
  it("does not count a drag, a long hold, a press for another item or no press", () => {
    expect(pressActivates(press, { x: 200, y: 700 + PRESS_SLOP_PX + 20, t: 1080 }, "i3")).toBe(false);
    expect(pressActivates(press, { x: 200, y: 700, t: 1000 + PRESS_MAX_MS + 1 }, "i3")).toBe(false);
    expect(pressActivates(press, { x: 200, y: 700, t: 1080 }, "i4")).toBe(false);
    expect(pressActivates(press, { x: 200, y: 700, t: 1080 }, null)).toBe(false);
    expect(pressActivates(null, { x: 200, y: 700, t: 1080 }, "i3")).toBe(false);
  });

  it("is wired into the shared game component, which keeps the review note's space from the start", () => {
    const src = readFileSync("src/features/games/game-session.tsx", "utf8");
    expect(src).toMatch(/onPointerDown=\{\(e\) => \{\s*nextPressRef\.current = \{ itemKey: item\.key/);
    expect(src).toContain('window.addEventListener("click", onClick, true)');
    expect(src).toContain("pressActivates(press,");
    // The handled click is not turned into a second "next" by the button's own onClick.
    expect(src).toContain("if (handledClickRef.current === e.nativeEvent) return;");
    // The review note is no longer mounted late (it was `{review && …}`), so nothing moves under the pointer.
    expect(src).not.toMatch(/\{review && \(/);
    expect(src).not.toMatch(/\{review && <p/);
  });
});
