import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/safe-next";
import { callbackUrl } from "@/lib/auth-redirect";

/** Regression: dot segments normalise to "//host", a protocol-relative open redirect (phase D review). */
describe("safeNext with dot segments", () => {
  const attacks = ["/.//evil.com", "/..//evil.com", "/a/..//evil.com", "/%2e//evil.com", "/././/evil.com"];
  it("never returns a protocol-relative path", () => {
    for (const a of attacks) {
      expect(safeNext(a), a).toBe("/account");
      expect(callbackUrl("https://spell.example", a), a).toBe("https://spell.example/auth/callback?next=%2Faccount");
    }
  });
  it("still normalises harmless dot segments", () => {
    expect(safeNext("/play/../review")).toBe("/review");
    expect(safeNext("/./progress")).toBe("/progress");
  });
});
