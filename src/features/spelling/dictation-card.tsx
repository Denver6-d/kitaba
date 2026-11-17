"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Eye, Turtle, Volume2 } from "lucide-react";
import type { SpellingWord } from "@/data/schema";
import { useI18n } from "@/i18n";
import { useSpeech } from "@/lib/speech";
import { Button } from "@/components/ui/button";

export interface DictationAnswer {
  readonly correct: boolean;
  readonly answer: string;
  /** True when the learner had to reveal the word (no voice available). */
  readonly revealed: boolean;
}

interface Props {
  readonly word: SpellingWord;
  readonly onAnswer: (a: DictationAnswer) => void;
  readonly onNext: () => void;
  /** Show feedback after checking (spelling trainer) or move straight on (diagnostic). */
  readonly showFeedback?: boolean;
  readonly showMeaning?: boolean;
  readonly extra?: React.ReactNode;
}

const normalizeWord = (s: string) => s.trim().toLowerCase().replace(/[‘’]/g, "'");

export function DictationCard({ word, onAnswer, onNext, showFeedback = true, showMeaning = true, extra }: Props) {
  const { t } = useI18n();
  const { status, speak } = useSpeech();
  const [value, setValue] = useState("");
  const [result, setResult] = useState<DictationAnswer | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  // Speak automatically when a new word appears (after the voice list is ready).
  useEffect(() => {
    if (status === "ready") speak(word.word);
    inputRef.current?.focus();
  }, [status, word.word, speak]);

  useEffect(() => {
    if (!revealing) return;
    const timer = window.setTimeout(() => {
      setRevealing(false);
      inputRef.current?.focus();
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [revealing]);

  const check = () => {
    if (result || value.trim() === "") return;
    const r: DictationAnswer = { correct: normalizeWord(value) === word.word, answer: value.trim(), revealed };
    onAnswer(r);
    if (!showFeedback) {
      onNext();
      return;
    }
    setResult(r);
    window.setTimeout(() => nextRef.current?.focus(), 0);
  };

  const canSpeak = status === "ready";

  return (
    <div className="sheet space-y-5 p-6 sm:p-8">
      <div className="flex flex-wrap items-center gap-2">
        {canSpeak ? (
          <>
            <Button size="lg" onClick={() => speak(word.word)} className="h-11 gap-2 px-5">
              <Volume2 className="size-5" aria-hidden="true" />
              {t.spelling.listen}
            </Button>
            <Button variant="outline" size="lg" onClick={() => speak(word.word, 0.6)} className="h-11 gap-2">
              <Turtle className="size-4" aria-hidden="true" />
              {t.spelling.slow}
            </Button>
            <Button variant="ghost" size="lg" onClick={() => speak(word.example)} className="h-11">
              {t.spelling.example}
            </Button>
          </>
        ) : status === "checking" ? (
          <p className="text-sm text-ink-soft">{t.common.loading}</p>
        ) : (
          <div className="w-full space-y-3">
            <p role="note" className="rounded-lg bg-brass-wash p-3 text-sm">
              {t.spelling.noVoice}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setRevealed(true);
                setRevealing(true);
              }}
              disabled={revealing || result !== null}
              className="h-10 gap-2"
            >
              <Eye className="size-4" aria-hidden="true" />
              {t.spelling.showWord}
            </Button>
            <p dir="ltr" lang="en" aria-live="polite" className="min-h-10 font-mono text-3xl">
              {revealing ? word.word : ""}
            </p>
          </div>
        )}
      </div>

      {showMeaning && (
        <p className="text-sm text-hint">
          {t.spelling.meaning}: <span lang="ar">{word.ar}</span>
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          check();
        }}
        className="space-y-3"
      >
        <label htmlFor={id} className="block text-sm font-medium">
          {t.spelling.typeHere}
        </label>
        <div className="flex flex-wrap gap-3">
          <input
            id={id}
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            readOnly={result !== null || revealing}
            dir="ltr"
            lang="en"
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={40}
            className={`h-12 min-w-0 flex-1 rounded-lg border bg-paper px-4 font-mono text-xl ${
              result ? (result.correct ? "border-correct" : "border-error") : "border-input focus:border-brass-fill"
            }`}
          />
          {!result && (
            <Button type="submit" size="lg" className="h-12 px-6" disabled={value.trim() === ""}>
              {t.common.check}
            </Button>
          )}
        </div>
      </form>

      {result && (
        <div role="status" className="space-y-3">
          {result.correct ? (
            <p className="font-semibold text-correct">{t.spelling.correct}</p>
          ) : (
            <div className="space-y-1">
              <p>
                <span className="text-ink-soft">{t.spelling.wrong}</span>{" "}
                <strong dir="ltr" lang="en" className="font-mono text-xl">
                  {word.word}
                </strong>
              </p>
              <p className="text-sm text-ink-soft">
                {t.spelling.yourAnswer}{" "}
                <span dir="ltr" lang="en" className="font-mono line-through decoration-error">
                  {result.answer}
                </span>
              </p>
            </div>
          )}
          <p className="text-sm text-ink-soft">
            {t.spelling.category}: {t.spelling.categories[word.category]}
          </p>
          <p className="text-sm text-ink-soft" dir="ltr" lang="en">
            {word.example}
          </p>
          {extra}
          <Button ref={nextRef} onClick={onNext} className="h-10">
            {t.spelling.next}
          </Button>
        </div>
      )}
    </div>
  );
}
