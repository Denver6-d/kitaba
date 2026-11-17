"use client";

import { useCallback } from "react";
import { starsFor, starsForTimed, summarize, xpForGame, type GameState, type GameSummary } from "@/domain/games/engine";
import { levelInfo } from "@/domain/progress/levels";
import type { StageRecord } from "@/domain/model";
import { useRepos } from "@/repositories/provider";
import type { SubmitStatus } from "@/repositories/types";
import { useAchievementCheck } from "@/features/rewards/use-achievement-check";
import { useLeaderboardSubmit } from "@/features/leaderboard/use-leaderboard";
import type { BuiltSession } from "./build-session";

export interface FinishOutcome {
  readonly summary: GameSummary;
  /** Stars for stage and daily games; null for free play and review. */
  readonly stars: number | null;
  readonly previous: StageRecord | null;
  readonly best: StageRecord | null;
  readonly xp: number;
  /** Set when this game moved the learner up a level. */
  readonly levelUp: number | null;
  /** Resolves when the leaderboard answers (null when nothing was sent). */
  readonly leaderboard: Promise<SubmitStatus | null>;
}

const MISSED_MAX = 100;

/** Saves a finished game: session, best stage result, activity (streak + XP), achievements, leaderboard. */
export function useFinishGame(): (session: BuiltSession, state: GameState) => Promise<FinishOutcome> {
  const repos = useRepos();
  const checkAchievements = useAchievementCheck();
  const submit = useLeaderboardSubmit();
  return useCallback(
    async (session, state) => {
      const summary = summarize(state);
      const stars =
        session.stageId === null
          ? null
          : session.config.durationMs !== null
            ? starsForTimed(summary.accuracy, summary.correct)
            : starsFor(summary.accuracy, summary.answered, session.boss);
      const xp = xpForGame(summary, stars ?? 0);
      const xpBefore = (await repos.activity.list()).reduce((n, a) => n + a.xp, 0);
      const { previous, best } = await repos.games.saveSession(
        {
          mode: session.mode,
          stageId: session.stageId,
          items: summary.answered,
          correct: summary.correct,
          points: summary.points,
          maxCombo: summary.maxCombo,
          seconds: summary.seconds,
          at: Date.now(),
          missed: summary.missed.slice(0, MISSED_MAX),
        },
        stars ?? 0,
      );
      await repos.activity.log(session.mode === "review" ? "review" : "game", summary.seconds, xp);
      await checkAchievements();
      const before = levelInfo(xpBefore).level;
      const after = levelInfo(xpBefore + xp).level;
      const leaderboard = submit({ points: summary.points, correct: summary.correct, total: summary.answered, durationS: summary.seconds });
      return { summary, stars, previous, best, xp, levelUp: after > before ? after : null, leaderboard };
    },
    [repos, checkAchievements, submit],
  );
}
