"use client";

import { useCallback } from "react";
import { keyStatsFromLog } from "@/domain/typing/key-stats";
import { recordGhost } from "@/domain/typing/ghost";
import { modeKey, type TestSource } from "@/domain/typing/personal-best";
import { xpFor } from "@/domain/progress/levels";
import { useRepos } from "@/repositories/provider";
import type { SaveTestOutcome } from "@/repositories/types";
import { useAchievementCheck } from "@/features/rewards/use-achievement-check";
import type { FinishedSession } from "./use-typing-session";

/** Persists a finished typing session: result, key stats, ghost, activity and achievements. */
export function useSaveTypingResult() {
  const repos = useRepos();
  const checkAchievements = useAchievementCheck();

  return useCallback(
    async (session: FinishedSession, source: TestSource, duration: number): Promise<SaveTestOutcome> => {
      const { state, metrics } = session;
      const outcome = await repos.progress.saveTestResult(
        {
          modeKey: modeKey(source, duration),
          source,
          duration,
          wpm: metrics.netWpm,
          rawWpm: metrics.rawWpm,
          accuracy: metrics.accuracy,
          consistency: metrics.consistency,
          chars: metrics.correctChars,
          errors: metrics.errors,
          layoutMismatches: state.layoutMismatches,
          samples: metrics.samples,
          at: Date.now(),
        },
        { keyStats: keyStatsFromLog(state.log), target: state.target, ghost: recordGhost(state) },
      );
      await repos.activity.log(
        source === "lesson" ? "lesson" : "typing",
        metrics.elapsedMs / 1000,
        xpFor({ kind: "typing-test", chars: metrics.correctChars, accuracy: metrics.accuracy }),
      );
      await checkAchievements();
      return outcome;
    },
    [repos, checkAchievements],
  );
}
