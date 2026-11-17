"use client";

import { useCallback, useMemo } from "react";
import { checkScore, isLeaderboardSource } from "@/domain/leaderboard/plausibility";
import type { TestSource } from "@/domain/typing/personal-best";
import type { LeaderboardRepository, ScoreSubmission, SubmitStatus } from "@/repositories/types";
import { createSupabaseLeaderboard } from "@/repositories/supabase/leaderboard";
import { useAccount } from "@/features/account/account-provider";

/** The leaderboard repository, or null when accounts are not configured. */
export function useLeaderboard(): LeaderboardRepository | null {
  const { client } = useAccount();
  return useMemo(() => (client ? createSupabaseLeaderboard(client) : null), [client]);
}

/**
 * Submits a standard timed test for a signed-in learner who joined the board.
 * Nothing is sent for anyone else, or for results the server would reject anyway.
 * Resolves to null when nothing was sent. Never throws.
 */
export function useLeaderboardSubmit(): (source: TestSource, s: ScoreSubmission) => Promise<SubmitStatus | null> {
  const { user } = useAccount();
  const board = useLeaderboard();
  return useCallback(
    async (source, s) => {
      if (!user || !board || !isLeaderboardSource(source) || checkScore(s) !== "ok") return null;
      try {
        if ((await board.myNickname()) === null) return null;
        return await board.submit(s);
      } catch {
        return "error";
      }
    },
    [user, board],
  );
}
