"use client";

import Link from "next/link";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";

/** Offered until the learner has taken the diagnostic (or explicitly skipped it). */
export function DiagnosticBanner() {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-brass-fill/50 bg-brass-wash p-5">
      <div>
        <p className="font-semibold">{t.diagnostic.banner}</p>
        <p className="text-sm text-ink-soft">{t.home.finalBody}</p>
      </div>
      <Button asChild className="h-10">
        <Link href="/diagnostic">{t.home.ctaDiagnostic}</Link>
      </Button>
    </div>
  );
}
