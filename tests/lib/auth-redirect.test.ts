import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { callbackProblem, callbackUrl, EMAIL_SIGNIN_ENABLED, emailSignInEnabled, ENABLED_OAUTH_PROVIDERS, enabledOAuthProviders, isOAuthProvider, OAUTH_PROVIDERS, signInLayout } from "@/lib/auth-redirect";
import { en } from "@/i18n/en";
import { ar } from "@/i18n/ar";

describe("OAuth providers", () => {
  it("offers Google only (no GitHub, no Apple)", () => {
    expect([...OAUTH_PROVIDERS]).toEqual(["google"]);
    expect(isOAuthProvider("github")).toBe(false);
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

describe("callbackUrl edges", () => {
  it("accepts an origin with a trailing slash", () => {
    expect(callbackUrl("https://spell.example/")).toBe("https://spell.example/auth/callback?next=%2Faccount");
  });
  it("falls back to /account when next is null", () => {
    expect(callbackUrl("https://spell.example", null)).toBe("https://spell.example/auth/callback?next=%2Faccount");
  });
  it("keeps a same-site next with its query and hash, fully encoded into one parameter", () => {
    const url = callbackUrl("https://spell.example", "/play?mode=a&b=1#top");
    expect(url).toBe("https://spell.example/auth/callback?next=%2Fplay%3Fmode%3Da%26b%3D1%23top");
    expect(new URL(url ?? "").searchParams.get("next")).toBe("/play?mode=a&b=1#top");
  });
  it("rejects non-http schemes and strings that carry more than an origin", () => {
    for (const origin of ["ftp://spell.example", "https://user:pw@spell.example", "https://spell.example?x=1", "https://spell.example#a", ""]) {
      expect(callbackUrl(origin)).toBeNull();
    }
  });
});

describe("callbackProblem edges", () => {
  const q = (s: string) => new URLSearchParams(s);
  it("treats access_denied in either error or error_code as a cancel", () => {
    expect(callbackProblem(q("error=server_error&error_code=access_denied"))).toBe("cancelled");
    expect(callbackProblem(q("error=access_denied&error_code=otp_expired"))).toBe("cancelled");
    expect(callbackProblem(q("error=server_error&error_code=otp_expired"))).toBe("failed");
  });
  it("treats error_code alone like error", () => {
    expect(callbackProblem(q("error_code=access_denied"))).toBe("cancelled");
    expect(callbackProblem(q("error_code=otp_expired"))).toBe("failed");
  });
  it("treats an empty error parameter as a failure, not as no error", () => {
    expect(callbackProblem(q("error="))).toBe("failed");
  });
});

describe("Google sign-in flag (NEXT_PUBLIC_ENABLE_GOOGLE_SIGNIN)", () => {
  it("hides Google by default, leaving no OAuth button (email only)", () => {
    expect([...enabledOAuthProviders(undefined)]).toEqual([]);
    expect([...enabledOAuthProviders("")]).toEqual([]);
  });
  it("shows Google only for exactly true", () => {
    expect([...enabledOAuthProviders("true")]).toEqual(["google"]);
    expect([...enabledOAuthProviders(" true ")]).toEqual(["google"]);
    for (const v of ["false", "1", "yes", "TRUE", "True", "on"]) expect([...enabledOAuthProviders(v)], v).toEqual([]);
  });
  it("is off in this build when the flag is not set", () => {
    if (process.env.NEXT_PUBLIC_ENABLE_GOOGLE_SIGNIN === undefined) expect(ENABLED_OAUTH_PROVIDERS).not.toContain("google");
  });
  it("reads the flag by its literal name, so Next.js inlines it at build time", () => {
    const src = readFileSync(new URL("../../src/lib/auth-redirect.ts", import.meta.url), "utf8");
    expect(src).toContain("process.env.NEXT_PUBLIC_ENABLE_GOOGLE_SIGNIN");
  });
});

describe("GitHub sign-in is gone (DECISIONS R7)", () => {
  it("has no GitHub button, mark or provider left in the sign-in code", () => {
    for (const file of ["../../src/features/account/auth-forms.tsx", "../../src/lib/auth-redirect.ts", "../../src/app/auth/callback/callback-view.tsx", "../../src/app/privacy/page.tsx"]) {
      expect(readFileSync(new URL(file, import.meta.url), "utf8"), file).not.toMatch(/github/i);
    }
  });
});

describe("Email sign-in flag (NEXT_PUBLIC_ENABLE_EMAIL_SIGNIN, DECISIONS O6)", () => {
  it("is off by default and on only for exactly true", () => {
    expect(emailSignInEnabled(undefined)).toBe(false);
    expect(emailSignInEnabled("")).toBe(false);
    expect(emailSignInEnabled("true")).toBe(true);
    expect(emailSignInEnabled(" true ")).toBe(true);
    for (const v of ["false", "1", "yes", "TRUE", "True", "on"]) expect(emailSignInEnabled(v), v).toBe(false);
  });
  it("is off in this build when the flag is not set", () => {
    if (process.env.NEXT_PUBLIC_ENABLE_EMAIL_SIGNIN === undefined) expect(EMAIL_SIGNIN_ENABLED).toBe(false);
  });
  it("reads the flag by its literal name, so Next.js inlines it at build time", () => {
    const src = readFileSync(new URL("../../src/lib/auth-redirect.ts", import.meta.url), "utf8");
    expect(src).toContain("process.env.NEXT_PUBLIC_ENABLE_EMAIL_SIGNIN");
  });
});

describe("signInLayout", () => {
  it("Google only: the Google button, no email forms and no 'or' divider", () => {
    expect(signInLayout(["google"], false)).toEqual({ oauth: ["google"], email: false, divider: false, none: false });
  });
  it("Google and email: both, with the divider between them", () => {
    expect(signInLayout(["google"], true)).toEqual({ oauth: ["google"], email: true, divider: true, none: false });
  });
  it("email only: the forms, no divider", () => {
    expect(signInLayout([], true)).toEqual({ oauth: [], email: true, divider: false, none: false });
  });
  it("neither: the 'accounts are not available yet' state", () => {
    expect(signInLayout([], false)).toEqual({ oauth: [], email: false, divider: false, none: true });
  });
});

describe("the sign-in screen follows the layout", () => {
  const forms = readFileSync(new URL("../../src/features/account/auth-forms.tsx", import.meta.url), "utf8");
  it("renders the email forms only when email is on, and the divider only when asked", () => {
    expect(forms).toMatch(/\{layout\.email && <EmailForms \/>\}/);
    expect(forms).toMatch(/\{divider && \(/);
    expect(forms).toMatch(/if \(layout\.none\) return <AccountsUnavailable \/>/);
  });
  it("keeps the email code (sign-in, sign-up, magic link, reset) so it can be switched back on", () => {
    for (const call of ["signInWithPassword", "signUp(", "signInWithOtp", "resetPasswordForEmail"]) expect(forms, call).toContain(call);
  });
  it("hides the password reset page behind the same flag", () => {
    const reset = readFileSync(new URL("../../src/app/account/reset/page.tsx", import.meta.url), "utf8");
    expect(reset).toMatch(/if \(!EMAIL_SIGNIN_ENABLED\)/);
  });
  it("the Google error no longer points to email", () => {
    expect(en.account.oauthError).not.toMatch(/email/i);
    expect(ar.account.oauthError).not.toMatch(/البريد/);
  });
});
