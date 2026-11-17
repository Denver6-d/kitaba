"use client";

import { useId, useRef, useState } from "react";
import { Lightbulb } from "lucide-react";
import type { Sentence } from "@/data/schema";
import { gradeSentence, type GradeResult } from "@/domain/sentences/grader";
import { acceptedAnswers } from "@/data/sentences";
import { ERROR_NAMES, explain, NOTE_TEXT } from "@/domain/sentences/explanations";
import type { HintLevel } from "@/domain/progress/hints";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { DiffView } from "./diff-view";

/** "I a_ a s______." keeps first letters and word shapes: a hint, not the answer. */
function maskedHint(answer: string, level: HintLevel): string {
  const words = answer.split(" ");
  if (level === "partial") return `${words[0] ?? ""} …`;
  return words.map((w) => w.replace(/^([A-Za-z'])([A-Za-z']*)/, (_m, a: string, rest: string) => a + rest.replace(/[A-Za-z]/g, "_"))).join(" ");
}

interface Props {
  readonly sentence: Sentence;
  readonly hint: HintLevel;
  readonly onGraded: (result: GradeResult, input: string) => void;
  readonly onNext: () => void;
}

export function SentenceCard({ sentence, hint, onGraded, onNext }: Props) {
  const { t, lang, pct } = useI18n();
  const [value, setValue] = useState("");
  const [result, setResult] = useState<GradeResult | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [announce, setAnnounce] = useState("");
  const hintRef = useRef<HTMLParagraphElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  const model = sentence.en[0] ?? "";
  const other = lang === "ar" ? "en" : "ar";

  const check = () => {
    if (result || value.trim() === "") return;
    const r = gradeSentence(value, acceptedAnswers(sentence));
    setResult(r);
    onGraded(r, value);
    const v = r.correct ? t.sentences.correct : r.score >= 0.8 ? t.sentences.almost : t.sentences.keepGoing;
    setAnnounce(`${v}. ${t.sentences.model}: ${sentence.en.includes(r.best) ? r.best : model}`);
    // Let the live region speak before focus moves to the Next button.
    window.setTimeout(() => nextRef.current?.focus(), 500);
  };

  const verdict = result ? (result.correct ? t.sentences.correct : result.score >= 0.8 ? t.sentences.almost : t.sentences.keepGoing) : null;

  return (
    <div className="sheet space-y-6 p-6 sm:p-8">
      {/* Always mounted: screen readers announce the verdict when its text changes. */}
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      <div className="space-y-2">
        <p className="text-sm text-ink-soft">
          {t.sentences.prompt} <span className="ms-1 rounded bg-muted px-1.5 py-0.5 text-xs">{sentence.level}</span>
        </p>
        <p lang="ar" dir="rtl" className="font-arabic text-2xl leading-relaxed font-semibold sm:text-3xl">
          {sentence.ar}
        </p>
      </div>

      {hint !== "none" && !result && (
        <div className="min-h-8">
          {showHint ? (
            <p ref={hintRef} tabIndex={-1} dir="ltr" lang="en" className="font-mono text-hint outline-none">
              {maskedHint(model, hint)}
            </p>
          ) : (
            <button
              type="button"
              onClick={() => {
                setShowHint(true);
                window.setTimeout(() => hintRef.current?.focus(), 0);
              }} className="inline-flex items-center gap-1.5 text-sm text-hint underline-offset-4 hover:underline">
              <Lightbulb className="size-4" aria-hidden="true" />
              {hint === "full" ? t.sentences.hintFull : t.sentences.hintPartial}
            </button>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          check();
        }}
        className="space-y-3"
      >
        <label htmlFor={id} className="sr-only">
          {t.sentences.inputLabel}
        </label>
        <textarea
          id={id}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              check();
            }
          }}
          readOnly={result !== null}
          autoFocus
          dir="ltr"
          lang="en"
          rows={2}
          maxLength={300}
          autoCapitalize="sentences"
          autoCorrect="off"
          spellCheck={false}
          placeholder={t.common.englishOnly}
          className="w-full resize-none rounded-lg border border-input bg-paper p-3 font-mono text-lg focus:border-brass-fill"
        />
        {!result && (
          <div className="flex flex-wrap gap-3">
            <Button type="submit" size="lg" className="h-11 px-6" disabled={!value.trim()}>
              {t.sentences.check}
            </Button>
            <Button type="button" variant="ghost" size="lg" className="h-11" onClick={() => setShowAnswer((s) => !s)}>
              {t.sentences.showAnswer}
            </Button>
          </div>
        )}
        {!result && showAnswer && (
          <p dir="ltr" lang="en" className="font-mono text-ink-soft">
            {model}
          </p>
        )}
      </form>

      {result && (
        <section className="space-y-5">
          <p className={`flex items-baseline gap-3 text-lg font-semibold ${result.correct ? "text-correct" : result.score >= 0.8 ? "text-brass" : "text-error"}`}>
            {verdict}
            <span className="text-sm font-normal text-ink-soft tabular">{pct(result.score * 100)}</span>
          </p>

          {!result.correct && (
            <div className="space-y-2">
              <p className="text-xs text-ink-soft">{t.sentences.diffLegend}</p>
              <DiffView diff={result.diff} />
            </div>
          )}

          {/* A far-off answer gets one clear message instead of a list of "different word" items. */}
          {result.errors.length > 4 && result.score < 0.35 && !showDetails && (
            <div className="space-y-2">
              <p>{t.sentences.farOff}</p>
              <button type="button" onClick={() => setShowDetails(true)} className="text-sm text-ink-soft underline underline-offset-4">
                {t.sentences.showDetails}
              </button>
            </div>
          )}

          {result.errors.length > 0 && (result.errors.length <= 4 || result.score >= 0.35 || showDetails) && (
            <div className="space-y-3">
              <h3 className="font-semibold">{t.sentences.errorsTitle}</h3>
              <ul className="space-y-3">
                {result.errors.map((e, i) => {
                  const x = explain(e);
                  return (
                    <li key={i} className="border-s-2 border-error/60 ps-3">
                      <p className="text-sm font-semibold">{ERROR_NAMES[e.type][lang]}</p>
                      <p className="text-sm" lang={lang}>
                        {x[lang]}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-soft" lang={other} dir={other === "ar" ? "rtl" : "ltr"}>
                        {x[other]}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {result.notes.length > 0 && (
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">{t.sentences.notesTitle}</h3>
              <ul className="list-inside list-disc text-sm text-ink-soft">
                {result.notes.map((n) => (
                  <li key={n}>{NOTE_TEXT[n][lang]}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-1 rounded-lg bg-muted p-4">
            <p className="text-xs text-ink-soft">{t.sentences.model}</p>
            <p dir="ltr" lang="en" className="font-mono text-lg">
              {sentence.en.includes(result.best) ? result.best : model}
            </p>
            {sentence.en.length > 1 && (
              <>
                <p className="pt-2 text-xs text-ink-soft">{t.sentences.otherAnswers}</p>
                <ul dir="ltr" lang="en" className="font-mono text-sm text-ink-soft">
                  {sentence.en
                    .filter((a) => a !== (sentence.en.includes(result.best) ? result.best : model))
                    .map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                </ul>
              </>
            )}
          </div>

          <Button ref={nextRef} onClick={onNext} size="lg" className="h-11 px-6">
            {t.sentences.next}
          </Button>
        </section>
      )}
    </div>
  );
}
