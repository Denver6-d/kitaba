"use client";

import { Languages } from "lucide-react";
import { useI18n } from "@/i18n";
import { ar } from "@/i18n/ar";

/**
 * Shown when Arabic characters arrive during an English test. Always includes
 * the Arabic wording, because the learner may not read the English UI yet.
 */
export function LayoutHint({ meant }: { meant: string | null }) {
  const { t, lang } = useI18n();
  return (
    <div role="alert" className="flex gap-3 rounded-xl border border-brass-fill/60 bg-brass-wash px-4 py-3">
      <Languages className="mt-0.5 size-5 shrink-0 text-brass" aria-hidden="true" />
      <div className="space-y-1 text-sm">
        <p lang="ar" dir="rtl" className="font-semibold">
          {ar.test.layoutTitle}
        </p>
        <p lang="ar" dir="rtl">
          {ar.test.layoutBody}
        </p>
        {lang === "en" && (
          <p lang="en" dir="ltr" className="text-ink-soft">
            {t.test.layoutTitle}. {t.test.layoutBody}
          </p>
        )}
        {meant && (
          <p className="text-ink-soft">
            {t.test.layoutMeant("")}
            <kbd dir="ltr" className="ms-1 rounded border border-rule bg-sheet px-1.5 font-mono">
              {meant === " " ? "Space" : meant}
            </kbd>
          </p>
        )}
      </div>
    </div>
  );
}
