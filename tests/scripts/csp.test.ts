import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { inlineScripts, metaPolicy, run, scriptHash, withCspMeta } from "../../scripts/csp-hashes.mjs";
import { contentSecurityPolicy, metaScriptPolicy, supabaseOrigins } from "@/config/csp";
import { PRE_PAINT_SCRIPT } from "@/lib/settings";

/** Security review finding 1 (DECISIONS SEC1). */
const directive = (policy: string, name: string) =>
  policy
    .split(";")
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${name} `));

describe("header Content-Security-Policy", () => {
  const prod = contentSecurityPolicy({ supabaseUrl: "https://abcd.supabase.co", dev: false });

  it("limits connections to this site and the Supabase project", () => {
    expect(directive(prod, "connect-src")).toBe("connect-src 'self' https://abcd.supabase.co wss://abcd.supabase.co");
    expect(directive(contentSecurityPolicy({ supabaseUrl: undefined, dev: false }), "connect-src")).toBe("connect-src 'self'");
  });
  it("forbids framing, plugins and foreign form targets", () => {
    expect(directive(prod, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(prod, "object-src")).toBe("object-src 'none'");
    expect(directive(prod, "base-uri")).toBe("base-uri 'self'");
    expect(directive(prod, "form-action")).toBe("form-action 'self'");
  });
  it("allows eval only in development", () => {
    expect(directive(prod, "script-src")).not.toContain("unsafe-eval");
    expect(directive(contentSecurityPolicy({ supabaseUrl: undefined, dev: true }), "script-src")).toContain("'unsafe-eval'");
  });
  it("loads scripts, fonts and media from this site only (plus blob: audio)", () => {
    expect(directive(prod, "script-src")).toBe("script-src 'self' 'unsafe-inline'");
    expect(directive(prod, "font-src")).toBe("font-src 'self'");
    expect(directive(prod, "media-src")).toBe("media-src 'self' blob:");
  });
  it("accepts only https Supabase URLs, or http on localhost", () => {
    expect(supabaseOrigins("http://127.0.0.1:54321")).toEqual(["http://127.0.0.1:54321", "ws://127.0.0.1:54321"]);
    expect(supabaseOrigins("http://evil.example")).toEqual([]);
    expect(supabaseOrigins("not a url")).toEqual([]);
    expect(supabaseOrigins("https://x.supabase.co/rest/v1")).toEqual(["https://x.supabase.co", "wss://x.supabase.co"]);
  });
});

describe("zod runs without eval under the CSP", () => {
  it("the pre-paint script switches zod to jitless before any bundle, keeping other zod settings", () => {
    const sandbox: Record<string, unknown> = { __zod_globalConfig: { locale: "x" }, localStorage: { getItem: () => null }, document: { documentElement: { dataset: {}, style: { setProperty() {} }, setAttribute() {} } }, location: { pathname: "/privacy" }, matchMedia: () => ({ matches: true }) };
    runInNewContext(PRE_PAINT_SCRIPT, sandbox);
    expect(sandbox.__zod_globalConfig).toEqual({ locale: "x", jitless: true });
  });
});

describe("per-page <meta> policy (scripts/csp-hashes.mjs)", () => {
  const page =
    '<!DOCTYPE html><html><head><meta charSet="utf-8"/><script src="/_next/static/a.js" async=""></script>' +
    `<script>${PRE_PAINT_SCRIPT}</script></head><body><script>self.__next_f.push([1,"x"])</script></body></html>`;

  it("hashes exactly the inline scripts, not the external ones", () => {
    expect(inlineScripts(page)).toEqual([PRE_PAINT_SCRIPT, 'self.__next_f.push([1,"x"])']);
    expect(scriptHash("alert(1)")).toBe(`'sha256-${createHash("sha256").update("alert(1)").digest("base64")}'`);
  });

  it("puts the policy after <meta charSet>, before the first script", () => {
    const out = withCspMeta(page)!;
    const meta = out.indexOf('<meta http-equiv="Content-Security-Policy"');
    expect(meta).toBe(out.indexOf('<meta charSet="utf-8"/>') + '<meta charSet="utf-8"/>'.length);
    expect(meta).toBeLessThan(out.indexOf("<script"));
    expect(out).toContain(metaPolicy([scriptHash(PRE_PAINT_SCRIPT), scriptHash('self.__next_f.push([1,"x"])')]));
    expect(out).not.toContain("unsafe-inline");
  });

  it("is idempotent: running twice keeps one tag with the same hashes", () => {
    const once = withCspMeta(page)!;
    expect(withCspMeta(once)).toBe(once);
  });

  it("refuses a page whose first script comes before <head>", () => {
    expect(withCspMeta("<script>x()</script><html><head></head></html>")).toBeNull();
  });

  it("agrees with metaScriptPolicy() in src/config/csp.ts", () => {
    const hashes = ["'sha256-a'", "'sha256-b'"];
    expect(metaPolicy(hashes)).toBe(metaScriptPolicy(hashes));
  });

  it("rewrites every .html file under the build folder", () => {
    const dir = mkdtempSync(join(tmpdir(), "csp-"));
    try {
      mkdirSync(join(dir, "app", "play"), { recursive: true });
      writeFileSync(join(dir, "app", "index.html"), page);
      writeFileSync(join(dir, "app", "play", "game.html"), page);
      writeFileSync(join(dir, "app", "index.rsc"), "not html");
      expect(run(dir)).toBe(2);
      expect(readFileSync(join(dir, "app", "play", "game.html"), "utf8")).toContain("Content-Security-Policy");
      expect(readFileSync(join(dir, "app", "index.rsc"), "utf8")).toBe("not html");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
