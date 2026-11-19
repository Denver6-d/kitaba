"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { gateDecision, LEVELS_MARKER, rememberLevels, shouldGate, welcomeHref } from "@/lib/first-visit";
import { useRepoContext } from "@/repositories/provider";
import { useAccount } from "@/features/account/account-provider";

/** Longest the page stays hidden while the level check waits (storage or the first sync). */
const MAX_WAIT_MS = 8000;

const html = () => (typeof document === "undefined" ? null : document.documentElement);
const readMarker = () => {
  try {
    return localStorage.getItem(LEVELS_MARKER) !== null;
  } catch {
    return false;
  }
};
const release = () => html()?.removeAttribute("data-gate");

/**
 * Central first-visit redirect (DECISIONS L1). Mounted once in the providers:
 * on every page it reads the stored levels, and a visitor who has none is sent
 * to /welcome with the page they asked for in `next`. The page stays hidden
 * (data-gate) until then, so it never flashes; every other outcome shows it.
 */
export function FirstVisitGate() {
  const pathname = usePathname();
  const router = useRouter();
  const { repos, revision, persistent } = useRepoContext();
  const { ready, user, sync } = useAccount();
  /** The profile's level source, tagged with the page it was read for. */
  const [read, setRead] = useState<{ path: string; source: string | null | "error" } | null>(null);
  const [timedOutPath, setTimedOutPath] = useState<string | null>(null);
  /** Pages already decided: a later data change (sync, "delete my data") never yanks the learner away. */
  const decided = useRef<string | null>(null);

  // Client-side navigation to a gated page: hide it before paint, as the pre-paint script does on a full load.
  useLayoutEffect(() => {
    if (decided.current === pathname) return;
    if (shouldGate(pathname) && persistent && !readMarker()) html()?.setAttribute("data-gate", "pending");
  }, [pathname, persistent]);

  useEffect(() => {
    let alive = true;
    repos.profile
      .get()
      .then((p) => alive && setRead({ path: pathname, source: p.levelSource }))
      .catch(() => alive && setRead({ path: pathname, source: "error" }));
    return () => {
      alive = false;
    };
  }, [repos, revision, pathname]);

  useEffect(() => {
    const timer = window.setTimeout(() => setTimedOutPath(pathname), MAX_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  const levelSource = read && read.path === pathname ? read.source : undefined;
  const decision = gateDecision({
    pathname,
    levelSource,
    persistent,
    accountReady: ready,
    signedIn: user !== null,
    syncStatus: sync?.status ?? null,
    timedOut: timedOutPath === pathname,
  });

  useEffect(() => {
    if (levelSource !== undefined && levelSource !== "error") rememberLevels(levelSource !== null);
    if (decision === "wait" || decided.current === pathname) {
      if (decided.current === pathname) release();
      return;
    }
    decided.current = pathname;
    if (decision === "show") release();
    else router.replace(welcomeHref(pathname, window.location.search));
  }, [decision, levelSource, pathname, router]);

  return null;
}
