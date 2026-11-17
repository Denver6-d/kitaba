"use client";

import { useCallback } from "react";
import { earnedAchievements, type AchievementStats } from "@/domain/progress/achievements";
import { levelInfo } from "@/domain/progress/levels";
import { longestStreak } from "@/domain/progress/streak";
import { isBossStage, WORLD_COUNT } from "@/domain/games/campaign";
import { useRepos } from "@/repositories/provider";
import type { Repositories } from "@/repositories/types";

export const ACHIEVEMENT_EVENT = "spelling:achievements";

/** V1 dictation logged 3 XP for a correct word and 1 for a miss. */
const V1_CORRECT_XP = 3;

/** Summarises stored progress for the achievement rules. */
export async function buildAchievementStats(repos: Repositories): Promise<AchievementStats> {
  const [activity, sessions, stages] = await Promise.all([repos.activity.list(), repos.games.sessions(), repos.games.stages()]);
  const stageList = Object.values(stages);
  return {
    games: sessions.length,
    correctWords:
      sessions.reduce((n, s) => n + s.correct, 0) + activity.filter((a) => a.kind === "spelling" && a.xp >= V1_CORRECT_XP).length,
    longestStreak: longestStreak(activity.map((a) => a.day)),
    totalStars: stageList.filter((s) => !s.id.startsWith("daily:")).reduce((n, s) => n + s.stars, 0),
    perfectStages: stageList.filter((s) => s.stars === 3 && !s.id.startsWith("daily:")).length,
    bossesCleared: stageList.filter((s) => isBossStage(s.id) && s.stars > 0).length,
    worldsTotal: WORLD_COUNT,
    bestCombo: Math.max(0, ...sessions.map((s) => s.maxCombo)),
    dailyDone: stageList.filter((s) => s.id.startsWith("daily:") && s.stars > 0).length,
    reviewsDone: sessions.filter((s) => s.mode === "review").reduce((n, s) => n + s.items, 0),
    practiceLevel: levelInfo(activity.reduce((s, a) => s + a.xp, 0)).level,
  };
}

/** Checks the rules after a game, stores new unlocks and announces them (see AchievementToast). */
export function useAchievementCheck(): () => Promise<string[]> {
  const repos = useRepos();
  return useCallback(async () => {
    const earned = earnedAchievements(await buildAchievementStats(repos));
    const fresh = await repos.achievements.unlock(earned);
    if (fresh.length > 0) window.dispatchEvent(new CustomEvent<string[]>(ACHIEVEMENT_EVENT, { detail: fresh }));
    return fresh;
  }, [repos]);
}
