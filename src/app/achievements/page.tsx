"use client";

import Link from "next/link";
import { Award, Lock } from "lucide-react";
import { ACHIEVEMENTS } from "@/domain/progress/achievements";
import { useI18n } from "@/i18n";
import { useRepoQuery } from "@/repositories/provider";
import { Page, LoadingBlock } from "@/components/page";
import { ACHIEVEMENT_TEXT } from "@/features/rewards/achievement-text";

export default function AchievementsPage() {
  const { t, lang, date, num } = useI18n();
  const unlocked = useRepoQuery((r) => r.achievements.list());
  const byId = new Map(unlocked.status === "ready" ? unlocked.data.map((a) => [a.id, a.unlockedAt]) : []);

  return (
    <Page
      title={t.achievements.title}
      intro={t.achievements.intro}
      actions={
        <Link href="/certificate" className="font-medium text-brass underline-offset-4 hover:underline">
          {t.achievements.certificate}
        </Link>
      }
    >
      {unlocked.status === "loading" ? (
        <LoadingBlock label={t.common.loading} />
      ) : (
        <>
          <p className="mb-6 text-sm text-ink-soft tabular">
            {num(byId.size)} / {num(ACHIEVEMENTS.length)}
          </p>
          <ul className="grid gap-x-10 border-t border-rule sm:grid-cols-2 lg:grid-cols-3">
            {ACHIEVEMENTS.map((a) => {
              const at = byId.get(a.id);
              const text = ACHIEVEMENT_TEXT[a.id]?.[lang];
              return (
                <li key={a.id} className={`flex gap-4 border-b border-rule py-5 ${at ? "" : "opacity-70"}`}>
                  <span
                    className={`grid size-11 shrink-0 place-items-center rounded-full ${at ? "bg-brass-wash text-brass" : "bg-muted text-ink-soft"}`}
                    aria-hidden="true"
                  >
                    {at ? <Award className="size-5" /> : <Lock className="size-4" />}
                  </span>
                  <div>
                    <p className="font-semibold">{text?.title ?? a.id}</p>
                    <p className="text-sm text-ink-soft">{text?.body}</p>
                    <p className="mt-1 text-xs text-ink-soft">{at ? t.achievements.unlocked(date(at)) : t.achievements.locked}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Page>
  );
}
