import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { en } from "@/i18n/en";

/**
 * How the shared game screen handles a phone after Check (DECISIONS M9). The suite has no DOM
 * library (R25), so the wiring is read from the sources; the rules themselves are unit-tested in
 * tests/domain/games/advance.test.ts, and the flow was checked with real touch and IME input in
 * headless Chrome.
 */
const src = (p: string) => readFileSync(new URL(`../../src/${p}`, import.meta.url), "utf8");
const game = src("features/games/game-session.tsx");

describe("Check on a touch device", () => {
  it("closes the field first, then checks the committed text", () => {
    expect(game).toMatch(/const checkField = \(\) => \{[\s\S]*?if \(!mayAutoFocusText\(\) && el\) \{[\s\S]*?el\.blur\(\);\s*text = sanitizeAnswer\(el\.value\);/);
    expect(game).toMatch(/const onEnter = \(\) => \{\s*if \(answered\) goNext\(\);\s*else checkField\(\);/);
  });
  it("closes the field for 'I don't know' too", () => {
    expect(game).toMatch(/if \(!mayAutoFocusText\(\)\) \{[\s\S]{0,160}inputRef\.current\?\.blur\(\);\s*\}\s*submit\("", \{ forcedWrong: true \}\)/);
  });
  it("keeps the field read-only while the result shows, so it cannot bring the keyboard back", () => {
    expect(game).toMatch(/readOnly=\{coarse && answered\}/);
    expect(src("components/spelling-input.tsx")).toMatch(/readOnly=\{readOnly\}/);
  });
  it("moves focus to Next and reveals a hidden result once the keyboard has closed, for every item kind", () => {
    expect(game).toMatch(/if \(!mayAutoFocusText\(\)\) revealResultOnTouch\(\);/);
    expect(game).toMatch(/nextRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
    expect(game).toMatch(/if \(r\.top >= 0 && r\.bottom <= visible\) return;/);
  });
});

describe("moving on", () => {
  it("ignores every input event while a result shows on touch; only a keyboard can type to continue", () => {
    expect(game).toMatch(/if \(answered && touch && ev\.type !== "keydown"\) return;/);
    expect(game).toMatch(/typingAdvances\(touch, reduceAnswerInput\(input\.state, ev\)\.advanceRequested\)/);
  });
  it("carries nothing into the next word on touch", () => {
    expect(game).toMatch(/takesTyping\(following\) && carriesIntoNext\(touch\)/);
  });
  it("applies the settle rule to Check, I don't know and Next, including the M2 window handler", () => {
    expect(game.match(/if \(tapIgnored\(e\)\) return;/g)?.length).toBe(3);
    expect(game.match(/onPointerDown=\{notePress\}/g)?.length).toBe(2);
    expect(game).toMatch(/tapTooSoon\(\{ touch: !mayAutoFocusText\(\), keyboard: false, changedAt: barChangedAtRef\.current, pressedAt: press\.t \}\)/);
    expect(game.match(/barChangedAtRef\.current = t;/g)?.length).toBe(2); // the verdict and the next word
  });
  it("hides the 'press Enter or start typing' hint on touch devices", () => {
    expect(en.game.pressEnter).toMatch(/Enter/);
    expect(game).toMatch(/\{answered && showInput && !coarse && <p[^>]*>\{t\.game\.pressEnter\}<\/p>\}/);
  });
});

describe("the bottom navigation during a game", () => {
  it("hides while any game session is on screen, including review on /review", () => {
    expect(game).toMatch(/useEffect\(\(\) => enterGame\(\), \[\]\);/);
    const nav = src("components/shell/bottom-nav.tsx");
    expect(nav).toMatch(/const inGame = useSyncExternalStore\(subscribeGameActive, isGameActive, \(\) => false\);/);
    expect(nav).toMatch(/\|\| inGame \|\|/);
  });
});
