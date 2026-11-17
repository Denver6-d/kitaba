"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Check, X } from "lucide-react";
import { scenarios } from "@/data/scenarios";
import { checkMessage, wordCount, type CheckResult } from "@/domain/professional/checklist";
import { xpFor } from "@/domain/progress/levels";
import { useI18n } from "@/i18n";
import { useRepos } from "@/repositories/provider";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { useAchievementCheck } from "@/features/rewards/use-achievement-check";

const MAX_CHARS = 4000;

export function ScenarioWriter({ id }: { id: string }) {
  const { t, lang, num } = useI18n();
  const repos = useRepos();
  const checkAchievements = useAchievementCheck();
  const scenario = scenarios.find((s) => s.id === id);
  const [text, setText] = useState("");
  const [results, setResults] = useState<CheckResult[] | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const fieldId = useId();
  if (!scenario) return null;

  const words = wordCount(text);
  const label = (r: CheckResult): string => {
    if (r.id.startsWith("mention-")) {
      const m = scenario.mustMention[Number(r.id.slice(8))];
      return t.professional.checks.mention(m ? (lang === "ar" ? m.labelAr : m.labelEn) : "");
    }
    return t.professional.checks[r.id as Exclude<CheckResult["id"], `mention-${number}`>];
  };

  const review = () => {
    const r = checkMessage(text, scenario);
    setResults(r);
    const passed = r.filter((c) => c.passed).length;
    (async () => {
      await repos.scenarios.saveAttempt({ scenarioId: scenario.id, text, passed, total: r.length, at: Date.now() });
      await repos.activity.log("scenario", Math.min(900, 60 + words * 3), xpFor({ kind: "scenario", passed, total: r.length }));
      await checkAchievements();
    })().catch(() => setSaveFailed(true));
  };

  const passed = results?.filter((c) => c.passed).length ?? 0;

  return (
    <Page
      title={lang === "ar" ? scenario.titleAr : scenario.titleEn}
      actions={
        <Link href="/professional" className="text-sm text-ink-soft underline-offset-4 hover:underline">
          {t.professional.title}
        </Link>
      }
    >
      <div className="grid gap-10 lg:grid-cols-2">
        <section className="space-y-4">
          <div className="rounded-xl bg-brass-wash p-4">
            <p className="mb-1 text-xs font-semibold text-brass">{t.professional.brief}</p>
            <p>{lang === "ar" ? scenario.briefAr : scenario.briefEn}</p>
            {lang === "en" && (
              <p lang="ar" dir="rtl" className="mt-2 text-sm text-hint">
                {scenario.briefAr}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <label htmlFor={fieldId} className="font-medium">
                {t.professional.write}
              </label>
              <span className={`text-sm tabular ${words > scenario.maxWords ? "text-error" : "text-ink-soft"}`} aria-live="off">
                {t.professional.words(words)} · {t.professional.lengthRange(scenario.minWords, scenario.maxWords)}
              </span>
            </div>
            <textarea
              id={fieldId}
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
              dir="ltr"
              lang="en"
              rows={14}
              spellCheck={false}
              autoCorrect="off"
              placeholder={"Dear …,\n\n…\n\nBest regards,\n…"}
              className="w-full rounded-xl border border-input bg-sheet p-4 font-mono text-base leading-relaxed shadow-sheet focus:border-brass-fill"
            />
          </div>
          <Button size="lg" className="h-11 px-6" onClick={review} disabled={text.trim() === ""}>
            {t.professional.check}
          </Button>
          {saveFailed && (
            <p role="alert" className="text-sm text-error">
              {t.results.saveFailed}
            </p>
          )}
        </section>

        <section className="space-y-6" aria-live="polite">
          {results ? (
            <>
              <div>
                <h2 className="flex items-baseline gap-3 text-xl font-semibold">
                  {t.professional.checklist}
                  <span className={`text-base tabular ${passed === results.length ? "text-correct" : "text-brass"}`}>
                    {t.professional.passed(passed, results.length).replace(/\d+/g, (d) => num(Number(d)))}
                  </span>
                </h2>
                <ul className="mt-3 space-y-2">
                  {results.map((r) => (
                    <li key={r.id} className="flex items-start gap-2.5">
                      {r.passed ? (
                        <Check className="mt-0.5 size-5 shrink-0 text-correct" aria-hidden="true" />
                      ) : (
                        <X className="mt-0.5 size-5 shrink-0 text-error" aria-hidden="true" />
                      )}
                      <span className={r.passed ? "" : "font-medium"}>
                        <span className="sr-only">{r.passed ? "✓ " : "✗ "}</span>
                        {label(r)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h2 className="mb-2 text-xl font-semibold">{t.professional.model}</h2>
                <pre dir="ltr" lang="en" className="sheet overflow-x-auto p-5 font-mono text-sm leading-relaxed whitespace-pre-wrap">
                  {scenario.modelAnswer}
                </pre>
              </div>
            </>
          ) : (
            <p className="text-sm text-ink-soft">{t.professional.note}</p>
          )}
        </section>
      </div>
    </Page>
  );
}
