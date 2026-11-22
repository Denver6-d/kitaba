import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BLOCKED_WORDS, normalizeForFilter, validateNickname } from "@/domain/leaderboard/nickname";
import { checkScore, LEADERBOARD_RULES } from "@/domain/leaderboard/plausibility";

const migration = (name: string) => readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8");
const sql = migration("20261117000002_leaderboard.sql");
/** The security-hardening migration replaces submit_score() and the nickname normaliser (DECISIONS SEC3, SEC4). */
const hardening = migration("20261122000001_security_hardening.sql");

/** The body of the last definition of a SQL function in a migration. */
function sqlFunction(text: string, name: string): string {
  const start = text.lastIndexOf(`create or replace function public.${name}(`);
  if (start < 0) throw new Error(`no ${name} in the migration`);
  return text.slice(start, text.indexOf("$$;", start));
}

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
  it("drops the tatweel and folds Arabic letter variants (security review finding 3)", () => {
    expect(normalizeForFilter("كـلب")).toBe("كلب");
    expect(normalizeForFilter("قحبة")).toBe("قحبه");
    expect(normalizeForFilter("أإآا")).toBe("اااا");
    expect(normalizeForFilter("على")).toBe("علي");
  });
  it("blocks the bypasses found in the review", () => {
    for (const n of ["كـلب123", "حمـار12", "قحبه12", "قـحـبـة", "زباله_1", "شرمـوط"]) {
      expect(validateNickname(n)).toEqual({ ok: false, error: "blocked" });
    }
  });
  it("still accepts ordinary Arabic names, with or without tatweel", () => {
    expect(validateNickname("سارة")).toEqual({ ok: true, value: "سارة" });
    expect(validateNickname("عـلي")).toEqual({ ok: true, value: "عـلي" });
    expect(validateNickname("مصطفى")).toEqual({ ok: true, value: "مصطفى" });
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
    expect(checkScore({ ...ok, durationS: 14 })).toBe("implausible");
    expect(checkScore({ ...ok, durationS: 15 })).toBe("ok");
    expect(checkScore({ ...ok, points: -1 })).toBe("implausible");
  });
  it("treats NaN and fractions as invalid rather than passing the comparisons", () => {
    expect(checkScore({ ...ok, durationS: Number.NaN })).toBe("implausible");
    expect(checkScore({ ...ok, points: 10.5 })).toBe("implausible");
  });
  it("accepts the best possible game: a full combo with every speed bonus", () => {
    expect(checkScore({ points: 60 * 45, correct: 60, total: 60, durationS: 90 })).toBe("ok");
  });
  it("accepts the fastest Spelling Bee the app plans for: 40 words in 60 seconds", () => {
    expect(checkScore({ points: 40 * 45, correct: 40, total: 40, durationS: 60 })).toBe("ok");
    expect(checkScore({ points: 40 * 45, correct: 40, total: 40, durationS: 59 })).toBe("implausible");
  });
});

describe("client rules match the SQL migrations", () => {
  it("uses the same thresholds as the latest submit_score()", () => {
    const fn = sqlFunction(hardening, "submit_score");
    expect(fn).toContain(`p_total < ${LEADERBOARD_RULES.minItems}`);
    expect(fn).toContain(`p_total > ${LEADERBOARD_RULES.maxItems}`);
    expect(fn).toContain(`p_correct * 100 < p_total * ${LEADERBOARD_RULES.minAccuracy}`);
    expect(fn).toContain(`p_points > p_correct * ${LEADERBOARD_RULES.maxPointsPerCorrect}`);
    expect(fn).toContain(`p_duration_s * 10 < p_total * ${LEADERBOARD_RULES.minSecondsPerItem * 10}`);
    expect(fn).toContain(`interval '${LEADERBOARD_RULES.minSecondsBetween} seconds'`);
    expect(fn).toContain(`>= ${LEADERBOARD_RULES.maxPerDay} then`);
  });
  it("folds the same Arabic letters as normalizeForFilter()", () => {
    const fn = sqlFunction(hardening, "normalize_nickname_for_filter");
    const u = (s: string) => [...s].map((c) => "\\" + c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")).join("");
    expect(fn).toContain(`U&'${u("\u0629\u0623\u0625\u0622\u0649\u0640")}'`);
    expect(fn).toContain(`U&'${u("\u0647\u0627\u0627\u0627\u064A")}'`);
    // ة→ه, أ/إ/آ→ا, ى→ي, tatweel dropped
    for (const [from, to] of [["\u0629", "\u0647"], ["\u0623", "\u0627"], ["\u0625", "\u0627"], ["\u0622", "\u0627"], ["\u0649", "\u064A"], ["\u0640", ""]]) {
      expect(normalizeForFilter(`a${from}b`)).toBe(`a${to}b`);
    }
    expect(sqlFunction(hardening, "set_leaderboard_nickname")).toContain("position(public.normalize_nickname_for_filter(w.word) in norm)");
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
