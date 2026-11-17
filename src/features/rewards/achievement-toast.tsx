"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Award } from "lucide-react";
import { useI18n } from "@/i18n";
import { ACHIEVEMENT_EVENT } from "./use-achievement-check";
import { ACHIEVEMENT_TEXT } from "./achievement-text";

/** A quiet, self-dismissing note for newly unlocked achievements (no confetti). */
export function AchievementToast() {
  const { t, lang } = useI18n();
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    const on = (e: Event) => setIds((prev) => [...new Set([...prev, ...(e as CustomEvent<string[]>).detail])]);
    window.addEventListener(ACHIEVEMENT_EVENT, on);
    return () => window.removeEventListener(ACHIEVEMENT_EVENT, on);
  }, []);

  useEffect(() => {
    if (ids.length === 0) return;
    const timer = window.setTimeout(() => setIds([]), 6000);
    return () => window.clearTimeout(timer);
  }, [ids]);

  return (
    <div role="status" aria-live="polite" className="no-print pointer-events-none fixed inset-x-0 bottom-20 z-50 md:bottom-4 flex justify-center px-4">
      {ids.length > 0 && (
        <Link
          href="/progress#achievements"
          className="pointer-events-auto flex max-w-sm items-center gap-3 rounded-2xl border border-brass-fill/60 bg-sheet px-4 py-3 shadow-float animate-in fade-in slide-in-from-bottom-2"
        >
          <Award className="size-6 shrink-0 text-brass" aria-hidden="true" />
          <span className="text-sm">
            <span className="block text-xs text-ink-soft">{t.progress.newUnlock}</span>
            <span className="font-semibold">{ids.map((id) => ACHIEVEMENT_TEXT[id]?.[lang].title ?? id).join(" · ")}</span>
          </span>
        </Link>
      )}
    </div>
  );
}
