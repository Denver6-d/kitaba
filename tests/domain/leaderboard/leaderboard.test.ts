import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BLOCKED_WORDS, normalizeForFilter, validateNickname } from "@/domain/leaderboard/nickname";
import { checkScore, isLeaderboardSource, LEADERBOARD_RULES } from "@/domain/leaderboard/plausibility";

const sql = readFileSync(new URL("../../../supabase/migrations/20261117000002_leaderboard.sql", import.meta.url), "utf8");

describe("validateNickname", () => {
  it("accepts Latin and Arabic names with digits, spaces, _ and -", () => {
    expect(validateNickname("Omar_92")).toEqual({ ok: true, value: "Omar_92" });
    expect(validateNickname("سارة")).toEqual({ ok: true, value: "سارة" });
    expect(validateNickname("  Fast   Typist  ")).toEqual({ ok: true, value: "Fast Typist" });
    expect(validateNickname("a-b")).toEqual({ ok: true, value: "a-b" });
  });
  it("enforces 3 to 20 characters", () => {
    expect(validateNickname("ab")).toEqual({ ok: false, error: "length" });
    expect(validateNickname("a".repeat(21))).toEqual({ ok: false, error: "length" });
  });
  it("rejects other characters (emoji, punctuation, markup)", () => {
    for (const n of ["omar!", "<script>", "ali😀", "a.b.c", "x@y.com"]) {
      expect(validateNickname(n)).toEqual({ ok: false, error: "chars" });
    }
  });
  it("blocks inappropriate and reserved words, even disguised", () => {
    expect(validateNickname("admin")).toEqual({ ok: false, error: "blocked" });
    expect(validateNickname("Kitaba Team")).toEqual({ ok: false, error: "blocked" });
    expect(validateNickname("sh1t_head")).toEqual({ ok: false, error: "blocked" });
    expect(validateNickname("F_U_C_K")).toEqual({ ok: false, error: "blocked" });
  });
  it("normalises leetspeak and separators for the filter", () => {
    expect(normalizeForFilter("Sh1t-Head")).toBe("shithead");
    expect(normalizeForFilter("@d m!n")).toBe("admin");
  });
});

describe("checkScore (mirror of submit_score)", () => {
  const ok = { wpm: 60, accuracy: 97, durationS: 60, chars: 300 };
  it("accepts a plausible result", () => {
    expect(checkScore(ok)).toBe("ok");
  });
  it("rejects short tests and low accuracy", () => {
    expect(checkScore({ ...ok, durationS: 15, chars: 75 })).toBe("too_short");
    expect(checkScore({ ...ok, accuracy: 85 })).toBe("low_accuracy");
  });
  it("rejects impossible speeds and inconsistent numbers", () => {
    expect(checkScore({ ...ok, wpm: 260, chars: 1300 })).toBe("implausible");
    expect(checkScore({ ...ok, chars: 100 })).toBe("implausible");
    expect(checkScore({ ...ok, wpm: -1 })).toBe("implausible");
  });
});

describe("client rules match the SQL migration", () => {
  it("uses the same thresholds", () => {
    expect(sql).toContain(`p_duration_s < ${LEADERBOARD_RULES.minDurationS}`);
    expect(sql).toContain(`p_accuracy < ${LEADERBOARD_RULES.minAccuracy}`);
    expect(sql).toContain(`p_wpm > ${LEADERBOARD_RULES.maxWpm}`);
    expect(sql).toContain(`interval '${LEADERBOARD_RULES.minSecondsBetween} seconds'`);
    expect(sql).toContain(`>= ${LEADERBOARD_RULES.maxPerDay}`);
  });
  it("seeds exactly the same blocked words", () => {
    const seed = /insert into public\.leaderboard_blocked_words \(word\) values\s*([\s\S]*?)\s*on conflict/.exec(sql)?.[1] ?? "";
    const words = [...seed.matchAll(/\('([^']+)'\)/g)].map((m) => m[1]).sort();
    expect(words).toEqual([...BLOCKED_WORDS].sort());
  });
});

describe("isLeaderboardSource", () => {
  it("lets only the standard timed tests compete", () => {
    expect(isLeaderboardSource("words")).toBe(true);
    expect(isLeaderboardSource("sentences")).toBe(true);
    for (const s of ["custom", "adaptive", "lesson", "diagnostic"] as const) expect(isLeaderboardSource(s)).toBe(false);
  });
});

describe("checkScore edge cases", () => {
  it("treats NaN as invalid rather than passing the comparisons", () => {
    expect(checkScore({ wpm: 60, accuracy: 97, durationS: Number.NaN, chars: 300 })).toBe("too_short");
    expect(checkScore({ wpm: 60, accuracy: Number.NaN, durationS: 60, chars: 300 })).toBe("low_accuracy");
    expect(checkScore({ wpm: Number.NaN, accuracy: 97, durationS: 60, chars: 300 })).toBe("implausible");
  });
  it("accepts a test that ended slightly early when the real elapsed time is used", () => {
    // 58.4 s of typing, 290 correct chars: 59.6 WPM.
    expect(checkScore({ wpm: 59.6, accuracy: 96, durationS: 58.4, chars: 290 })).toBe("ok");
  });
  it("matches the SQL rounding the client applies before sending", () => {
    expect(checkScore({ wpm: 59.6, accuracy: 96, durationS: Math.round(58.4), chars: 290 })).toBe("ok");
  });
});
