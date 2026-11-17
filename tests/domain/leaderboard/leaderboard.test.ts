import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BLOCKED_WORDS, normalizeForFilter, validateNickname } from "@/domain/leaderboard/nickname";
import { checkScore, LEADERBOARD_RULES } from "@/domain/leaderboard/plausibility";

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
  const ok = { points: 120, correct: 9, total: 10, durationS: 90 };
  it("accepts a plausible game", () => {
    expect(checkScore(ok)).toBe("ok");
  });
  it("rejects short games and low accuracy", () => {
    expect(checkScore({ points: 40, correct: 4, total: 4, durationS: 30 })).toBe("too_short");
    expect(checkScore({ ...ok, correct: 4 })).toBe("low_accuracy");
  });
  it("rejects impossible points, counts and speeds", () => {
    expect(checkScore({ ...ok, points: 9 * 45 + 1 })).toBe("implausible");
    expect(checkScore({ ...ok, points: 9 * 45 })).toBe("ok");
    expect(checkScore({ ...ok, correct: 11 })).toBe("implausible");
    expect(checkScore({ ...ok, total: 61, correct: 61 })).toBe("implausible");
    expect(checkScore({ ...ok, durationS: 9 })).toBe("implausible");
    expect(checkScore({ ...ok, points: -1 })).toBe("implausible");
  });
  it("treats NaN and fractions as invalid rather than passing the comparisons", () => {
    expect(checkScore({ ...ok, durationS: Number.NaN })).toBe("implausible");
    expect(checkScore({ ...ok, points: 10.5 })).toBe("implausible");
  });
  it("accepts the best possible game: a full combo with every speed bonus", () => {
    expect(checkScore({ points: 60 * 45, correct: 60, total: 60, durationS: 60 })).toBe("ok");
  });
});

describe("client rules match the SQL migration", () => {
  it("uses the same thresholds", () => {
    expect(sql).toContain(`p_total < ${LEADERBOARD_RULES.minItems}`);
    expect(sql).toContain(`p_total > ${LEADERBOARD_RULES.maxItems}`);
    expect(sql).toContain(`p_correct * 100 < p_total * ${LEADERBOARD_RULES.minAccuracy}`);
    expect(sql).toContain(`p_points > p_correct * ${LEADERBOARD_RULES.maxPointsPerCorrect}`);
    expect(sql).toContain(`p_duration_s < p_total * ${LEADERBOARD_RULES.minSecondsPerItem}`);
    expect(sql).toContain(`interval '${LEADERBOARD_RULES.minSecondsBetween} seconds'`);
    expect(sql).toContain(`>= ${LEADERBOARD_RULES.maxPerDay}`);
  });
  it("the score column limits allow the best possible game", () => {
    expect(sql).toContain(`points between 0 and ${LEADERBOARD_RULES.maxItems * LEADERBOARD_RULES.maxPointsPerCorrect}`);
  });
  it("seeds exactly the same blocked words", () => {
    const seed = /insert into public\.leaderboard_blocked_words \(word\) values\s*([\s\S]*?)\s*on conflict/.exec(sql)?.[1] ?? "";
    const words = [...seed.matchAll(/\('([^']+)'\)/g)].map((m) => m[1]).sort();
    expect(words).toEqual([...BLOCKED_WORDS].sort());
  });
});
