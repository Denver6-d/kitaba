"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { spellingWordById, spellingWords } from "@/data/words";
import { CATEGORY_INFO } from "@/data/rules";
import { buildItem } from "@/domain/games/items";
import { seededRng } from "@/domain/shared/random";
import { useI18n } from "@/i18n";
import { useSettings } from "@/lib/settings-store";
import { useClientSeed, useReducedMotion } from "@/lib/use-hydrated";

/** Words chosen to show the typical traps for Arabic speakers. */
const DEMO_IDS = ["w-receive", "w-separate", "w-necessary", "w-problem", "w-vegetable", "w-knowledge", "w-because", "w-accommodation"];

const bankSpellings = new Set(spellingWords.map((w) => w.word));

/** The hero is the product: a real "Pick the right spelling" round on a ruled sheet. */
export function HeroRound() {
  const { t, lang } = useI18n();
  const [settings] = useSettings();
  const seed = useClientSeed();
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const ref = useRef<HTMLDivElement>(null);

  const item = useMemo(() => {
    const id = DEMO_IDS[index % DEMO_IDS.length] ?? "w-receive";
    const word = spellingWordById.get(id);
    if (!word) return null;
    return buildItem("choice", word, { accent: settings.accent, rng: seededRng(seed + index), bankSpellings }, `demo-${index}`);
  }, [index, seed, settings.accent]);

  // One orchestrated reveal of the sheet on load (skipped with reduced motion).
  useEffect(() => {
    if (reduced || !ref.current) return;
    let alive = true;
    void import("gsap").then(({ gsap }) => {
      if (alive && ref.current) gsap.fromTo(ref.current, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" });
    });
    return () => {
      alive = false;
    };
  }, [reduced]);

  const word = item ? spellingWordById.get(item.wordId) : undefined;
  if (!item || !word) return null;
  const answered = picked !== null;
  const right = picked === item.answer;

  return (
    <div ref={ref} className="sheet relative overflow-hidden p-6 sm:p-10">
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <p className="font-semibold text-brass">{t.home.demoLabel}</p>
        <p className="text-sm text-ink-soft tabular" aria-live="polite">
          {score.total > 0 ? t.home.demoScore(score.right, score.total) : ""}
        </p>
      </div>
      <p className="text-xl font-semibold">{t.home.demoQuestion}</p>
      <p className="mt-1 text-hint">
        {t.game.meaning}: <span lang="ar">{word.ar}</span>
      </p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2" dir="ltr" lang="en">
        {(item.options ?? []).map((o) => {
          const state = !answered ? "idle" : o === item.answer ? "right" : o === picked ? "wrong" : "dim";
          return (
            <li key={o}>
              <button
                type="button"
                disabled={answered}
                onClick={() => {
                  setPicked(o);
                  setScore((s) => ({ right: s.right + (o === item.answer ? 1 : 0), total: s.total + 1 }));
                }}
                className={`ruled min-h-16 w-full rounded-[10px] border-2 px-5 text-start font-mono text-2xl transition-colors sm:text-3xl ${
                  state === "right"
                    ? "border-correct bg-[var(--correct-wash)] text-correct"
                    : state === "wrong"
                      ? "border-error bg-[var(--error-wash)] text-error line-through"
                      : state === "dim"
                        ? "border-rule opacity-50"
                        : "border-rule-strong bg-paper hover:border-brass-fill"
                }`}
              >
                {o}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-6 min-h-24" aria-live="polite">
        {answered && (
          <div className="space-y-2">
            <p className={`text-lg font-semibold ${right ? "text-correct" : "text-error"}`}>
              {right ? t.home.demoCorrect : `${t.home.demoWrong} · `}
              {!right && (
                <span dir="ltr" lang="en" className="font-mono">
                  {item.answer}
                </span>
              )}
            </p>
            <p className="text-hint">{CATEGORY_INFO[word.category].rule[lang]}</p>
            <button
              type="button"
              onClick={() => {
                setPicked(null);
                setIndex((i) => i + 1);
              }}
              className="min-h-11 rounded-md px-1 font-medium text-brass underline underline-offset-4"
            >
              {t.home.demoNext}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
