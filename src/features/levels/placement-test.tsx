"use client";

import { useEffect, useRef, useState } from "react";
import { spellingWords } from "@/data/words";
import type { SpellingWord } from "@/data/schema";
import { buildItem } from "@/domain/games/items";
import type { GameItem } from "@/domain/games/engine";
import {
  answerPlacement,
  pickPlacementWord,
  PLACEMENT_ITEMS,
  placementDone,
  placementLevel,
  placementResult,
  startPlacement,
  type PlacementResult,
  type PlacementState,
} from "@/domain/levels/placement";
import { seededRng, type Rng } from "@/domain/shared/random";
import type { Accent } from "@/domain/spelling/check";
import { useI18n } from "@/i18n";
import { useSettings } from "@/lib/settings-store";
import { Button } from "@/components/ui/button";
import { bankSpellings } from "@/features/games/build-session";

/** British/American pairs depend on the chosen variant, so they stay out of the placement test. */
const PLACEMENT_WORDS: readonly SpellingWord[] = spellingWords.filter((w) => w.category !== "british-american");

interface Question {
  readonly word: SpellingWord;
  readonly item: GameItem;
}

/**
 * The adaptive placement test (DECISIONS E4): one "pick the right spelling"
 * question at a time, harder after a right answer and easier after a wrong one.
 */
function nextQuestion(state: PlacementState, used: ReadonlySet<string>, rng: Rng, accent: Accent): Question | null {
  const taken = new Set(used);
  for (let tries = 0; tries < 8; tries += 1) {
    const word = pickPlacementWord(PLACEMENT_WORDS, placementLevel(state), taken, rng);
    if (!word) return null;
    taken.add(word.id);
    const item = buildItem("choice", word, { accent, rng, bankSpellings }, `place-${state.answers.length}`);
    if (item) return { word, item };
  }
  return null;
}

interface Run {
  readonly state: PlacementState;
  readonly used: ReadonlySet<string>;
  readonly question: Question | null;
}

/**
 * The adaptive placement test (DECISIONS E4): one "pick the right spelling"
 * question at a time, harder after a right answer and easier after a wrong one.
 * Render it only on the client, after the learner asked for it (it is random).
 */
export function PlacementTest({ seed, onDone }: { seed: number; onDone: (r: PlacementResult) => void }) {
  const { t } = useI18n();
  const [settings] = useSettings();
  const [rng] = useState(() => seededRng(seed));
  const [run, setRun] = useState<Run>(() => {
    const state = startPlacement();
    const question = nextQuestion(state, new Set(), rng, settings.accent);
    return { state, used: new Set(question ? [question.word.id] : []), question };
  });
  const [picked, setPicked] = useState<string | null>(null);
  const optionsRef = useRef<HTMLUListElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const { state, question } = run;

  useEffect(() => {
    if (picked !== null) nextRef.current?.focus();
    else optionsRef.current?.querySelector("button")?.focus();
  }, [picked, question]);

  const advance = (correct: boolean) => {
    if (!question) return;
    const nextState = answerPlacement(state, { wordId: question.word.id, level: question.word.level, correct });
    const q = placementDone(nextState) ? null : nextQuestion(nextState, run.used, rng, settings.accent);
    setPicked(null);
    if (!q) {
      onDone(placementResult(nextState));
      return;
    }
    setRun({ state: nextState, used: new Set([...run.used, q.word.id]), question: q });
  };

  if (!question) return null;
  const { word, item } = question;
  const answered = picked !== null;
  const right = picked === item.answer;
  const n = state.answers.length + 1;

  return (
    <section aria-labelledby="placement-h" className="sheet space-y-6 p-5 sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="placement-h" className="text-xl font-semibold">
          {t.placement.title}
        </h2>
        <p className="text-sm text-ink-soft tabular">{t.placement.progress(n, PLACEMENT_ITEMS)}</p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className="h-full rounded-full bg-brass-fill transition-[width]" style={{ width: `${((n - 1) / PLACEMENT_ITEMS) * 100}%` }} />
      </div>
      <div className="space-y-1">
        <p className="text-lg font-semibold">{t.placement.question}</p>
        <p className="text-hint">
          {t.placement.meaning}: <span lang="ar">{word.ar}</span>
        </p>
        {item.context && (
          <p dir="ltr" lang="en" className="text-ink-soft">
            {item.context}
          </p>
        )}
      </div>
      <ul ref={optionsRef} className="grid gap-3 sm:grid-cols-2" dir="ltr" lang="en">
        {(item.options ?? []).map((o) => {
          const look = !answered ? "idle" : o === item.answer ? "right" : o === picked ? "wrong" : "dim";
          return (
            <li key={o}>
              <button
                type="button"
                disabled={answered}
                onClick={() => setPicked(o)}
                className={`ruled min-h-14 w-full rounded-[10px] border-2 px-4 text-start font-mono text-xl sm:text-2xl ${
                  look === "right"
                    ? "border-correct bg-[var(--correct-wash)] text-correct"
                    : look === "wrong"
                      ? "border-error bg-[var(--error-wash)] text-error line-through"
                      : look === "dim"
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
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-3" aria-live="polite">
        {answered && (
          <>
            <p className={`font-semibold ${right ? "text-correct" : "text-error"}`}>
              {right ? t.placement.correct : t.placement.wrong("")}
              {!right && (
                <span dir="ltr" lang="en" className="font-mono">
                  {item.answer}
                </span>
              )}
            </p>
            <Button
              ref={nextRef}
              className="h-11 px-6"
              onClick={() => advance(right)}
            >
              {t.common.next}
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
