"use client";

import { useCallback } from "react";
import { keyStatsFromLog } from "@/domain/typing/key-stats";
import { recordGhost } from "@/domain/typing/ghost";
import { modeKey, type TestSource } from "@/domain/typing/personal-best";
import { xpFor } from "@/domain/progress/levels";
import { useRepos } from "@/repositories/provider";
import type { SaveTestOutcome, SubmitStatus } from "@/repositories/types";
import { useAchievementCheck } from "@/features/rewards/use-achievement-check";
import { useLeaderboardSubmit } from "@/features/leaderboard/use-leaderboard";
import type { FinishedSession } from "./use-typing-session";

export interface SavedTypingResult extends SaveTestOutcome {
  /** Leaderboard submission (opted-in learners, standard timed tests). Runs after the local save and never rejects. */
  readonly leaderboard: Promise<SubmitStatus | null>;
}

/**
 * Persists a finished typing session: result, key stats, ghost, activity and achievements.
 * The local save never waits for the network.
 */
export function useSaveTypingResult() {
  const repos = useRepos();
  const checkAchievements = useAchievementCheck();
  const submitScore = useLeaderboardSubmit();

  return useCallback(
    async (session: FinishedSession, source: TestSource, duration: number): Promise<SavedTypingResult> => {
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
      // Real elapsed time: a timed test ends early when the text runs out.
      const leaderboard =
        duration > 0
          ? submitScore(source, { wpm: metrics.netWpm, accuracy: metrics.accuracy, durationS: metrics.elapsedMs / 1000, chars: metrics.correctChars })
          : Promise.resolve(null);
      return { ...outcome, leaderboard };
    },
    [repos, checkAchievements, submitScore],
  );
}
