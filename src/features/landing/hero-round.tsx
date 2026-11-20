"use client";

import { Check } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { spellingWordById, spellingWords } from "@/data/words";
import { CATEGORY_INFO } from "@/data/rules";
import { buildItem } from "@/domain/games/items";
import { seededRng } from "@/domain/shared/random";
import { useI18n } from "@/i18n";
import { useSettings } from "@/lib/settings-store";
import { useClientSeed } from "@/lib/use-hydrated";

/** Words chosen to show the typical traps for Arabic speakers. */
const DEMO_IDS = ["w-receive", "w-separate", "w-necessary", "w-problem", "w-vegetable", "w-knowledge", "w-because", "w-accommodation"];

const bankSpellings = new Set(spellingWords.map((w) => w.word));

/** The hero is the product: a real "Pick the right spelling" round on a sheet. */
export function HeroRound() {
  const { t, lang } = useI18n();
  const [settings] = useSettings();
  const seed = useClientSeed();
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const nextRef = useRef<HTMLButtonElement>(null);
  const optionsRef = useRef<HTMLUListElement>(null);
  const moved = useRef(false);

  const item = useMemo(() => {
    const id = DEMO_IDS[index % DEMO_IDS.length] ?? "w-receive";
    const word = spellingWordById.get(id);
    if (!word) return null;
    // The first item uses a fixed seed, so its options do not reshuffle after hydration.
    return buildItem("choice", word, { accent: settings.accent, rng: seededRng(index === 0 ? 0 : seed + index), bankSpellings }, `demo-${index}`);
  }, [index, seed, settings.accent]);

  // Keyboard users keep their place: Next after an answer, the first option after Next.
  useEffect(() => {
    if (picked !== null) nextRef.current?.focus();
    else if (moved.current) optionsRef.current?.querySelector("button")?.focus();
  }, [picked, index]);

  const word = item ? spellingWordById.get(item.wordId) : undefined;
  if (!item || !word) return null;
  const answered = picked !== null;
  const right = picked === item.answer;

  return (
    <div className="hero-reveal panel relative overflow-hidden p-6 sm:p-10">
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <p className="font-medium text-fg-2">{t.home.demoLabel}</p>
        <p className="text-sm text-fg-2 tabular" aria-live="polite">
          {score.total > 0 ? t.home.demoScore(score.right, score.total) : ""}
        </p>
      </div>
      <p className="text-xl font-semibold">{t.home.demoQuestion}</p>
      <p className="mt-1 text-fg-2">
        {t.game.meaning}: <span lang="ar">{word.ar}</span>
      </p>
      <ul ref={optionsRef} className="mt-6 grid gap-3 sm:grid-cols-2" dir="ltr" lang="en">
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
                className={`flex min-h-16 w-full items-center gap-3 rounded-[10px] border-2 px-5 text-start font-word text-2xl transition-colors sm:text-3xl ${
                  state === "right"
                    ? "border-fg bg-raised text-fg"
                    : state === "wrong"
                      ? "border-error bg-error-tint text-error line-through"
                      : state === "dim"
                        ? "border-line opacity-50"
                        : "border-line-strong bg-canvas hover:border-fg-2"
                }`}
              >
                {o}
                {state === "right" && <Check className="ms-auto size-6 shrink-0" aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-6 min-h-24" aria-live="polite">
        {answered && (
          <div className="space-y-2">
            <p className={`text-lg font-semibold ${right ? "text-fg" : "text-error"}`}>
              {right ? t.home.demoCorrect : `${t.home.demoWrong} · `}
              {!right && (
                <span dir="ltr" lang="en" className="font-word">
                  {item.answer}
                </span>
              )}
            </p>
            <p className="text-fg-2">{CATEGORY_INFO[word.category].rule[lang]}</p>
            <button
              ref={nextRef}
              type="button"
              onClick={() => {
                moved.current = true;
                setPicked(null);
                setIndex((i) => i + 1);
              }}
              className="min-h-11 rounded-md px-1 font-medium text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg-2"
            >
              {t.home.demoNext}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
