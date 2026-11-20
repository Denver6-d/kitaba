"use client";

import { Check } from "lucide-react";
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
import { GameHeading, GameTopBar } from "@/features/games/ui/game-top-bar";
import { CorrectLine } from "@/features/games/ui/correction";

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
export function PlacementTest({ seed, onDone, onExit }: { seed: number; onDone: (r: PlacementResult) => void; onExit: () => void }) {
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
    <section aria-labelledby="placement-h" className="mx-auto max-w-2xl space-y-8 pt-2 sm:space-y-10">
      <GameTopBar exitHref="/welcome" onExit={onExit} exitLabel={t.placement.quit} progress={(n - 1) / PLACEMENT_ITEMS} progressLabel={t.placement.progress(n, PLACEMENT_ITEMS)} />
      <GameHeading id="placement-h" title={t.placement.title} meta={t.placement.progress(n, PLACEMENT_ITEMS)} />
      <div className="space-y-2 text-center">
        <p className="text-fg-2">{t.placement.question}</p>
        <p className="text-lg">
          <span className="text-fg-3">{t.placement.meaning}: </span>
          <span lang="ar">{word.ar}</span>
        </p>
        {item.context && (
          <p dir="ltr" lang="en" className="text-xl">
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
                className={`flex min-h-16 w-full items-center gap-3 rounded-2xl border px-4 text-start font-word text-[clamp(1.25rem,4.5vw,1.5rem)] transition-colors ${
                  look === "right"
                    ? "border-fg bg-raised text-fg"
                    : look === "wrong"
                      ? "border-error border-dashed text-error line-through"
                      : look === "dim"
                        ? "border-line text-fg-3"
                        : "border-line-strong bg-surface hover:border-fg-2 hover:bg-raised"
                }`}
              >
                {o}
                {look === "right" && <Check className="ms-auto size-6 shrink-0" aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-3" aria-live="polite">
        {answered && (
          <>
            {right ? (
              <CorrectLine text={t.placement.correct} />
            ) : (
              <p className="text-lg">
                <span className="text-fg-2">{t.placement.wrong("")}</span>
                <span dir="ltr" lang="en" className="font-word text-xl">
                  {item.answer}
                </span>
              </p>
            )}
            <Button
              ref={nextRef}
              variant="primary"
              size="lg"
              className="w-full sm:w-auto sm:min-w-40"
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
