"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/i18n";
import { useHydrated } from "@/lib/use-hydrated";
import { LoadingBlock } from "@/components/page";
import { Welcome } from "@/features/levels/welcome";
import { useLevelCheck } from "@/features/levels/use-level-check";
import { returnPath, welcomeIntent, welcomeUrlWithoutIntent } from "@/lib/first-visit";

/**
 * /welcome: level choice or placement test (DECISIONS L2).
 * - A learner who already has a level (or progress) is sent straight on to `next`:
 *   the screen is shown once, and a reload never brings it back.
 * - `?retake=1` (Settings, "Retake the placement test") is the only way to take
 *   the test again; it starts the test at once. `?test=1` starts it for a learner
 *   who has no level yet.
 * - Both are removed from the address at once, so a reload (F5) during or after
 *   the test never starts it again.
 */
export function WelcomeView() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  // The test is random: render it only on the client.
  const hydrated = useHydrated();
  // The page the visitor first asked for (same-origin path only, never /welcome).
  const next = returnPath(params.get("next"));
  // Read once: the address loses these flags right after.
  const [intent] = useState(() => welcomeIntent(params));
  const check = useLevelCheck("/welcome");
  /** Decided once, so a level saved here (or a later sync) never yanks the learner off the result screen. */
  const [mode, setMode] = useState<"pending" | "welcome" | "leave">(intent.retake ? "welcome" : "pending");
  if (mode === "pending" && check !== "wait") setMode(check === "known" ? "leave" : "welcome");

  useEffect(() => {
    const clean = welcomeUrlWithoutIntent(window.location.href);
    if (clean) window.history.replaceState(window.history.state, "", clean);
  }, []);

  useEffect(() => {
    if (mode === "leave") router.replace(next);
  }, [mode, next, router]);

  return (
    <div className="mx-auto min-h-[calc(100svh-4rem)] max-w-3xl px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <h1 className="sr-only">{t.welcome.title}</h1>
      {hydrated && mode === "welcome" ? <Welcome startWithTest={intent.test} next={next} onSkip={() => router.replace(next)} /> : <LoadingBlock label={t.common.loading} />}
    </div>
  );
}
