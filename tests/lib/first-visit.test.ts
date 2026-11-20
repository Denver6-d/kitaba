import { runInNewContext } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { gateDecision, LEVELS_MARKER, returnPath, shouldGate, welcomeHref, type GateInput } from "@/lib/first-visit";
import { PRE_PAINT_SCRIPT } from "@/lib/settings";
import { I18nProvider } from "@/i18n";
import { RepositoriesProvider } from "@/repositories/provider";
import { Welcome } from "@/features/levels/welcome";
import { ar } from "@/i18n/ar";

/** First visit: every page sends a visitor without a level to /welcome, then back (DECISIONS L1). */

describe("shouldGate", () => {
  it("gates every learning page, with or without a query", () => {
    for (const p of ["/", "/play", "/play/game", "/write", "/write/dictation", "/review", "/progress", "/settings", "/leaderboard"]) expect(shouldGate(p), p).toBe(true);
  });
  it("never gates the welcome screen, legal, credits, offline, auth and sign-in pages", () => {
    for (const p of ["/welcome", "/privacy", "/credits", "/offline", "/auth/callback", "/account", "/account/reset"]) expect(shouldGate(p), p).toBe(false);
  });
  it("never gates API, static, content or service-worker requests", () => {
    for (const p of ["/api/x", "/_next/static/chunks/a.js", "/sw.js", "/manifest.webmanifest", "/icon.svg", "/content/v1/manifest.json", "/dict/en-US.dic"]) expect(shouldGate(p), p).toBe(false);
  });
  it("does not exempt look-alike paths", () => {
    expect(shouldGate("/welcomeback")).toBe(true);
    expect(shouldGate("/privacy-notes")).toBe(true);
  });
});

describe("welcomeHref and returnPath", () => {
  it("carries the page asked for, path and query, and brings the visitor back to it", () => {
    const href = welcomeHref("/play/game", "?stage=w3-s2");
    expect(href).toBe("/welcome?next=%2Fplay%2Fgame%3Fstage%3Dw3-s2");
    const next = new URL(href, "https://x.invalid").searchParams.get("next");
    expect(returnPath(next)).toBe("/play/game?stage=w3-s2");
    expect(welcomeHref("/", "")).toBe("/welcome?next=%2F");
    expect(welcomeHref("/play", "")).toBe("/welcome");
  });
  it("accepts same-origin relative paths only", () => {
    for (const bad of ["https://evil.example/", "//evil.example", "/\\evil.example", "/.//evil.example", "javascript:alert(1)", "/\tevil", ""]) expect(returnPath(bad), bad).toBe("/play");
    expect(returnPath(null)).toBe("/play");
  });
  it("never sends the visitor back to /welcome (no loop)", () => {
    for (const loop of ["/welcome", "/welcome?next=%2Fwelcome", "/welcome/", "/welcome#x"]) expect(returnPath(loop), loop).toBe("/play");
  });
});

describe("gateDecision", () => {
  const base: GateInput = { pathname: "/play", levelSource: null, persistent: true, accountReady: true, signedIn: false, syncStatus: null, timedOut: false };
  it("sends a visitor with no stored level to /welcome", () => {
    expect(gateDecision(base)).toBe("welcome");
  });
  it("shows the page once levels exist (choice, placement or skip)", () => {
    for (const s of ["choice", "placement", "skip"]) expect(gateDecision({ ...base, levelSource: s })).toBe("show");
  });
  it("waits (page hidden) while the profile loads, and shows it after the safety wait", () => {
    expect(gateDecision({ ...base, levelSource: undefined })).toBe("wait");
    expect(gateDecision({ ...base, levelSource: undefined, timedOut: true })).toBe("show");
  });
  it("shows the page normally when IndexedDB is blocked or unreadable", () => {
    expect(gateDecision({ ...base, persistent: false })).toBe("show");
    expect(gateDecision({ ...base, levelSource: "error" })).toBe("show");
  });
  it("lets a signed-in learner's first sync bring levels from the cloud before asking", () => {
    const signedIn = { ...base, signedIn: true };
    expect(gateDecision({ ...signedIn, syncStatus: "syncing" })).toBe("wait");
    expect(gateDecision({ ...signedIn, syncStatus: "syncing", levelSource: "choice" })).toBe("show");
    expect(gateDecision({ ...signedIn, syncStatus: "synced" })).toBe("welcome");
    expect(gateDecision({ ...signedIn, syncStatus: "offline" })).toBe("welcome");
    expect(gateDecision({ ...base, accountReady: false })).toBe("wait");
  });
  it("never redirects an exempt page", () => {
    expect(gateDecision({ ...base, pathname: "/welcome" })).toBe("show");
    expect(gateDecision({ ...base, pathname: "/privacy" })).toBe("show");
  });
});

describe("pre-paint: the page is hidden before first paint only when it may redirect", () => {
  function run(pathname: string, stored: Record<string, string>) {
    const attrs: Record<string, string> = {};
    const el = { lang: "", dir: "", dataset: {} as Record<string, string>, style: { setProperty: () => undefined }, setAttribute: (k: string, v: string) => (attrs[k] = v) };
    runInNewContext(PRE_PAINT_SCRIPT, {
      localStorage: { getItem: (k: string) => stored[k] ?? null },
      document: { documentElement: el },
      location: { pathname },
      matchMedia: () => ({ matches: false }),
    });
    return attrs["data-gate"];
  }
  it("hides a gated page for a browser that never stored levels", () => {
    expect(run("/play/game", {})).toBe("pending");
    expect(run("/", {})).toBe("pending");
  });
  it("never hides for a returning learner, an exempt page, or a static file", () => {
    expect(run("/play", { [LEVELS_MARKER]: "1" })).toBeUndefined();
    expect(run("/welcome", {})).toBeUndefined();
    expect(run("/auth/callback", {})).toBeUndefined();
    expect(run("/sw.js", {})).toBeUndefined();
  });
  it("shows the page when storage is blocked (the script must not throw)", () => {
    const attrs: Record<string, string> = {};
    const el = { dataset: {}, style: { setProperty: () => undefined }, setAttribute: (k: string, v: string) => (attrs[k] = v) };
    expect(() =>
      runInNewContext(PRE_PAINT_SCRIPT, {
        localStorage: {
          getItem: () => {
            throw new Error("SecurityError");
          },
        },
        document: { documentElement: el },
        location: { pathname: "/play" },
        matchMedia: () => ({ matches: false }),
      }),
    ).not.toThrow();
    expect(attrs["data-gate"]).toBeUndefined();
  });
});

describe("welcome screen", () => {
  it("makes 'Test my level' the first, primary action, with 'I choose my level' and 'Skip for now' secondary", () => {
    const html = renderToStaticMarkup(createElement(I18nProvider, null, createElement(RepositoriesProvider, null, createElement(Welcome, { onSkip: () => undefined }))));
    const order = [...html.matchAll(/data-welcome="(\w+)"/g)].map((m) => m[1]);
    expect(order).toEqual(["test", "choose", "skip"]);
    const tag = (name: string) => html.match(new RegExp(`<button[^>]*data-welcome="${name}"[^>]*>`))?.[0] ?? "";
    expect(tag("test")).toMatch(/data-variant="primary"/);
    expect(tag("test")).toMatch(/text-xl/);
    expect(tag("choose")).toMatch(/data-variant="outline"/);
    expect(tag("skip")).toMatch(/data-variant="quiet"/);
    expect(html).toContain(ar.welcome.test);
  });
});
