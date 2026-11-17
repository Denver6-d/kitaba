"use client";

import Link from "next/link";
import { scenarios } from "@/data/scenarios";
import { useI18n } from "@/i18n";
import { useRepoQuery } from "@/repositories/provider";
import { Page } from "@/components/page";

export default function ProfessionalPage() {
  const { t, lang, pct } = useI18n();
  const attempts = useRepoQuery((r) => r.scenarios.attempts());
  const best = new Map<string, number>();
  if (attempts.status === "ready") {
    for (const a of attempts.data) best.set(a.scenarioId, Math.max(best.get(a.scenarioId) ?? 0, a.total ? a.passed / a.total : 0));
  }

  return (
    <Page title={t.professional.title} intro={t.professional.intro}>
      <ul className="grid border-t border-rule md:grid-cols-2">
        {scenarios.map((s) => {
          const score = best.get(s.id);
          return (
            <li key={s.id} className="border-b border-rule md:odd:border-e md:odd:pe-8 md:even:ps-8">
              <Link href={`/professional/${s.id}`} className="group block space-y-2 py-6">
                <p className="flex items-center gap-2 text-xs text-ink-soft">
                  <span className="rounded bg-muted px-1.5 py-0.5">{s.level}</span>
                  {score !== undefined && (
                    <span className={score === 1 ? "text-correct" : "text-brass"}>
                      {pct(Math.round(score * 100))}
                    </span>
                  )}
                </p>
                <h2 className="text-lg font-semibold underline-offset-[6px] group-hover:underline group-hover:decoration-brass-fill">
                  {lang === "ar" ? s.titleAr : s.titleEn}
                </h2>
                <p className="text-sm text-ink-soft">{lang === "ar" ? s.briefAr : s.briefEn}</p>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-6 text-xs text-ink-soft">{t.professional.note}</p>
    </Page>
  );
}
