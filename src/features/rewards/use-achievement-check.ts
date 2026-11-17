"use client";

import { useCallback } from "react";
import { earnedAchievements, type AchievementStats } from "@/domain/progress/achievements";
import { levelInfo, xpFor } from "@/domain/progress/levels";
import { longestStreak } from "@/domain/progress/streak";
import { lessons } from "@/data/lessons";
import { scenarios } from "@/data/scenarios";
import { useRepos } from "@/repositories/provider";
import type { Repositories } from "@/repositories/types";

export const ACHIEVEMENT_EVENT = "kitaba:achievements";

const CORRECT_SPELLING_XP = xpFor({ kind: "spelling", correct: true });

/** Summarises stored progress for the achievement rules. */
export async function buildAchievementStats(repos: Repositories): Promise<AchievementStats> {
  const [results, activity, attempts, scenarioAttempts, mastery, profile] = await Promise.all([
    repos.progress.listResults(),
    repos.activity.list(),
    repos.sentences.attempts(),
    repos.scenarios.attempts(),
    repos.sentences.allMastery(),
    repos.profile.get(),
  ]);
  const timed = results.filter((r) => r.duration > 0);
  return {
    tests: timed.length,
    bestWpm: Math.max(0, ...timed.filter((r) => r.accuracy >= 80).map((r) => r.wpm)),
    bestMinuteAccuracy: Math.max(0, ...timed.filter((r) => r.duration >= 60 && r.wpm >= 10).map((r) => r.accuracy)),
    longestStreak: longestStreak(activity.map((a) => a.day)),
    // Activity records do not store the verdict; a correct dictation earns the higher XP.
    spellingCorrect: activity.filter((a) => a.kind === "spelling" && a.xp >= CORRECT_SPELLING_XP).length,
    sentencesCorrect: attempts.filter((a) => a.score === 1).length,
    scenariosCompleted: new Set(scenarioAttempts.filter((a) => a.total > 0 && a.passed === a.total).map((a) => a.scenarioId)).size,
    scenariosTotal: scenarios.length,
    lessonsDone: lessons.filter((l) => (mastery[`lesson:${l.id}`] ?? 0) > 0).length,
    lessonsTotal: lessons.length,
    diagnosticDone: profile.diagnosticAt !== null,
    practiceLevel: levelInfo(activity.reduce((s, a) => s + a.xp, 0)).level,
  };
}

/** Checks the rules after an activity, stores new unlocks and announces them (see AchievementToast). */
export function useAchievementCheck(): () => Promise<string[]> {
  const repos = useRepos();
  return useCallback(async () => {
    const earned = earnedAchievements(await buildAchievementStats(repos));
    const fresh = await repos.achievements.unlock(earned);
    if (fresh.length > 0) window.dispatchEvent(new CustomEvent<string[]>(ACHIEVEMENT_EVENT, { detail: fresh }));
    return fresh;
  }, [repos]);
}
