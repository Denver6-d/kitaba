"use client";

import { useEffect, useState } from "react";
import { hasLevelsMarker, levelCheck, rememberLevels, type LevelCheck } from "@/lib/first-visit";
import { useRepoContext } from "@/repositories/provider";
import { useAccount } from "@/features/account/account-provider";

/** Longest a page waits for the level check (storage or the first sync) before it stops insisting. */
export const LEVEL_CHECK_MAX_WAIT_MS = 8000;

interface Read {
  /** What the read was for (the gate re-reads on every page). */
  readonly key: string;
  /** The data revision the read started at: a read from before a sync pull is stale, never used. */
  readonly revision: number;
  readonly levelSource: string | null | "error";
  readonly hasProgress: boolean;
  readonly deviceMarker: boolean;
}

/**
 * Whether the learner still needs the level screen (DECISIONS L2). Waits for
 * local data and, for a signed-in learner, for the first pull; the decision
 * itself is the pure, tested `levelCheck`.
 */
export function useLevelCheck(key: string): LevelCheck {
  const { repos, revision } = useRepoContext();
  const { ready, user, sync } = useAccount();
  const [read, setRead] = useState<Read | null>(null);
  const [timedOutKey, setTimedOutKey] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      let r: Omit<Read, "key" | "revision">;
      try {
        const p = await repos.profile.get();
        const hasProgress = p.levelSource === null ? await repos.data.hasProgress() : false;
        r = { levelSource: p.levelSource, hasProgress, deviceMarker: hasLevelsMarker() };
      } catch {
        r = { levelSource: "error", hasProgress: false, deviceMarker: hasLevelsMarker() };
      }
      if (alive) setRead({ key, revision, ...r });
    })();
    return () => {
      alive = false;
    };
  }, [repos, revision, key]);

  useEffect(() => {
    const timer = window.setTimeout(() => setTimedOutKey(key), LEVEL_CHECK_MAX_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [key]);

  const fresh = read && read.key === key && read.revision === revision ? read : null;
  const seenLevels = fresh !== null && ((fresh.levelSource !== null && fresh.levelSource !== "error") || fresh.hasProgress);
  // Levels or progress on this device: remember it, so later pages are never hidden, not even for a frame.
  // Only from a fresh read: a read from before "delete my data" must not bring the marker back.
  useEffect(() => {
    if (seenLevels) rememberLevels();
  }, [seenLevels]);
  return levelCheck({
    levelSource: fresh ? fresh.levelSource : undefined,
    hasProgress: fresh?.hasProgress ?? false,
    deviceMarker: fresh?.deviceMarker ?? false,
    accountReady: ready,
    signedIn: user !== null,
    syncStatus: sync?.status ?? null,
    timedOut: timedOutKey === key,
  });
}
