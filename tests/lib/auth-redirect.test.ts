import { describe, expect, it } from "vitest";
import { callbackProblem, callbackUrl, isOAuthProvider, OAUTH_PROVIDERS } from "@/lib/auth-redirect";

describe("OAuth providers", () => {
  it("offers Google and GitHub only (no Apple)", () => {
    expect([...OAUTH_PROVIDERS]).toEqual(["google", "github"]);
    expect(isOAuthProvider("google")).toBe(true);
    expect(isOAuthProvider("apple")).toBe(false);
    expect(isOAuthProvider(undefined)).toBe(false);
  });
});

describe("callbackUrl (allow-listed redirect target)", () => {
  it("always points at this origin's /auth/callback", () => {
    expect(callbackUrl("https://spell.example", "/play")).toBe("https://spell.example/auth/callback?next=%2Fplay");
    expect(callbackUrl("http://localhost:3000")).toBe("http://localhost:3000/auth/callback?next=%2Faccount");
  });
  it("never forwards to another site, whatever next says", () => {
    for (const next of ["https://evil.example", "//evil.example", String.raw`/\evil.example`, "/\t/evil.example", "javascript:alert(1)"]) {
      expect(callbackUrl("https://spell.example", next)).toBe("https://spell.example/auth/callback?next=%2Faccount");
    }
  });
  it("rejects origins that are not plain http(s) origins", () => {
    expect(callbackUrl("javascript:alert(1)")).toBeNull();
    expect(callbackUrl("https://spell.example/path")).toBeNull();
    expect(callbackUrl("not a url")).toBeNull();
  });
});

describe("callbackProblem", () => {
  const q = (s: string) => new URLSearchParams(s);
  it("is calm when the user cancelled on the provider's screen", () => {
    expect(callbackProblem(q("error=access_denied&error_description=User+denied"))).toBe("cancelled");
  });
  it("reports other errors as failures, and nothing when there is no error", () => {
    expect(callbackProblem(q("error=server_error"))).toBe("failed");
    expect(callbackProblem(q("error_description=bad+code"))).toBe("failed");
    expect(callbackProblem(q("code=abc&next=%2Faccount"))).toBeNull();
  });
});
