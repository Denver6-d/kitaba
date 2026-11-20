"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/i18n";
import { useHydrated } from "@/lib/use-hydrated";
import { LoadingBlock } from "@/components/page";
import { Welcome } from "@/features/levels/welcome";
import { returnPath } from "@/lib/first-visit";

/** /welcome: level choice or placement test. `?test=1` starts the test at once (retake from settings). */
export function WelcomeView() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  // The test is random: render it only on the client.
  const hydrated = useHydrated();
  // The page the visitor first asked for (same-origin path only, never /welcome).
  const next = returnPath(params.get("next"));
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <h1 className="sr-only">{t.welcome.title}</h1>
      {hydrated ? <Welcome startWithTest={params.get("test") === "1"} next={next} onSkip={() => router.replace(next)} /> : <LoadingBlock label={t.common.loading} />}
    </div>
  );
}
