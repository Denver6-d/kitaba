import { describe, expect, it } from "vitest";
import {
  ALL_STAGE_IDS,
  dailyId,
  isBossStage,
  isStageUnlocked,
  isWorldUnlocked,
  nextStageAfter,
  nextStageToPlay,
  parseStageId,
  seedFrom,
  stageDef,
  WORLDS,
} from "@/domain/games/campaign";
import { SPELLING_CATEGORIES } from "@/domain/spelling/categories";
import type { StageRecord } from "@/domain/model";
import { parseGameRequest } from "@/features/games/parse-request";

const rec = (id: string, stars: number): StageRecord => ({ id, updatedAt: 1, stars, bestPoints: 10, clearedAt: stars > 0 ? 1 : 0 });
const stages = (...rows: StageRecord[]) => Object.fromEntries(rows.map((r) => [r.id, r]));

describe("campaign", () => {
  it("has 8 worlds × 10 stages covering every category", () => {
    expect(WORLDS).toHaveLength(8);
    expect(ALL_STAGE_IDS).toHaveLength(80);
    expect(new Set(WORLDS.flatMap((w) => w.categories))).toEqual(new Set(SPELLING_CATEGORIES));
  });

  it("parses stage ids strictly", () => {
    expect(parseStageId("w3-s10")).toEqual({ world: 3, stage: 10 });
    for (const bad of ["w0-s1", "w9-s1", "w1-s11", "w1-s0", "x", "w1-s1x"]) expect(parseStageId(bad)).toBeNull();
    expect(isBossStage("w2-s10")).toBe(true);
    expect(isBossStage("w2-s9")).toBe(false);
  });

  it("makes stage 9 a timed Spelling Bee and stage 10 a mixed boss with dictated sentences", () => {
    expect(stageDef("w1-s9")).toMatchObject({ timed: true, modes: "bee" });
    const boss = stageDef("w1-s10");
    expect(boss?.boss).toBe(true);
    expect(Array.isArray(boss?.modes)).toBe(true);
    expect(boss?.modes).toContain("sentence");
  });

  it("unlocks stage by stage with at least one star, and worlds by their previous boss", () => {
    expect(isStageUnlocked("w1-s1", {})).toBe(true);
    expect(isStageUnlocked("w1-s2", {})).toBe(false);
    expect(isStageUnlocked("w1-s2", stages(rec("w1-s1", 0)))).toBe(false);
    expect(isStageUnlocked("w1-s2", stages(rec("w1-s1", 1)))).toBe(true);
    expect(isWorldUnlocked(2, stages(rec("w1-s9", 3)))).toBe(false);
    expect(isStageUnlocked("w2-s1", stages(rec("w1-s10", 1)))).toBe(true);
  });

  it("knows where to continue and what comes next", () => {
    expect(nextStageToPlay({})).toBe("w1-s1");
    expect(nextStageToPlay(stages(rec("w1-s1", 2), rec("w1-s2", 1)))).toBe("w1-s3");
    expect(nextStageAfter("w1-s10")).toBe("w2-s1");
    expect(nextStageAfter("w8-s10")).toBeNull();
  });

  it("gives the daily challenge a stable id and seed per day", () => {
    expect(dailyId("2026-11-17")).toBe("daily:2026-11-17");
    expect(seedFrom("2026-11-17")).toBe(seedFrom("2026-11-17"));
    expect(seedFrom("2026-11-17")).not.toBe(seedFrom("2026-11-18"));
  });
});

describe("parseGameRequest", () => {
  const p = (q: string) => parseGameRequest(new URLSearchParams(q));
  it("reads stages, the daily challenge and free play", () => {
    expect(p("stage=w2-s4")).toEqual({ kind: "stage", id: "w2-s4" });
    expect(p("daily=1")).toEqual({ kind: "daily" });
    expect(p("mode=bee&level=B2&category=ie-ei")).toEqual({ kind: "free", mode: "bee", level: "B2", category: "ie-ei" });
  });
  it("falls back to safe defaults for anything unknown", () => {
    expect(p("stage=w99-s1&mode=hack&level=Z9&category=<script>")).toEqual({ kind: "free", mode: "listen", level: null, category: null });
    expect(p("mode=review")).toEqual({ kind: "free", mode: "listen", level: null, category: null });
  });
});
