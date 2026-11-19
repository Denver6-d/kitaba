"use client";

import { useCallback } from "react";
import { sameLevels, type CefrLevel, type LearnerLevels, type LevelArea, type LevelSource } from "@/domain/model";
import { useRepoQuery, useRepos } from "@/repositories/provider";
import { rememberLevels } from "@/lib/first-visit";

/** The learner's stored levels and setters. Every write goes through the profile (it syncs). */
export function useLevels() {
  const repos = useRepos();
  const profile = useRepoQuery((r) => r.profile.get());

  /** Changes one area; the next game reads it (build-session reads the profile on every build). */
  const setArea = useCallback(
    async (area: LevelArea, level: CefrLevel) => {
      const current = await repos.profile.get();
      await repos.profile.save({
        levels: { ...current.levels, [area]: level },
        levelSource: current.levelSource ?? "choice",
        levelsAt: Date.now(),
      });
      rememberLevels(true);
    },
    [repos],
  );

  /** Sets all three at once (welcome choice, placement result or skip). */
  const setAll = useCallback(
    async (level: CefrLevel | LearnerLevels, source: LevelSource) => {
      await repos.profile.save({ levels: typeof level === "string" ? sameLevels(level) : level, levelSource: source, levelsAt: Date.now() });
      // The next page opens without the first-visit check hiding it.
      rememberLevels(true);
    },
    [repos],
  );

  return { profile, setArea, setAll };
}
