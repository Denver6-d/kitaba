"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { gateFor, hasLevelsMarker, shouldGate, welcomeHref } from "@/lib/first-visit";
import { useRepoContext } from "@/repositories/provider";
import { useLevelCheck } from "./use-level-check";

const html = () => (typeof document === "undefined" ? null : document.documentElement);
const release = () => html()?.removeAttribute("data-gate");

/**
 * Central first-visit redirect (DECISIONS L1, L2). Mounted once in the
 * providers: on every gated page it checks the stored levels (useLevelCheck),
 * and a learner who certainly has none is sent to /welcome with the page they
 * asked for in `next`. The page stays hidden (data-gate) until then, so it
 * never flashes; every other outcome shows it.
 */
export function FirstVisitGate() {
  const pathname = usePathname();
  const router = useRouter();
  const { persistent } = useRepoContext();
  const check = useLevelCheck(pathname);
  /** Pages already decided: a later data change (sync, "delete my data") never yanks the learner away. */
  const decided = useRef<string | null>(null);

  // Client-side navigation to a gated page: hide it before paint, as the pre-paint script does on a full load.
  useLayoutEffect(() => {
    if (decided.current === pathname) return;
    if (shouldGate(pathname) && persistent && !hasLevelsMarker()) html()?.setAttribute("data-gate", "pending");
  }, [pathname, persistent]);

  const decision = gateFor(pathname, persistent, check);

  useEffect(() => {
    if (decision === "wait" || decided.current === pathname) {
      if (decided.current === pathname) release();
      return;
    }
    decided.current = pathname;
    if (decision === "show") release();
    else router.replace(welcomeHref(pathname, window.location.search));
  }, [decision, pathname, router]);

  return null;
}
