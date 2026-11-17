"use client";

import { useCallback } from "react";

/** Achievements arrive in phase 3; until then the check is a no-op. */
export function useAchievementCheck(): () => Promise<string[]> {
  return useCallback(async () => [], []);
}
