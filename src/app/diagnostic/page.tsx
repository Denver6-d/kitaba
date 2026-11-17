"use client";

import Link from "next/link";
import { useCallback, useId, useState } from "react";
import { buildPlan, placeLevel, type CefrLevel, type PlanStep } from "@/domain/progress/diagnostic";
import { gradeSentence } from "@/domain/sentences/grader";
import { seededRng } from "@/domain/shared/random";
import { xpFor } from "@/domain/progress/levels";
import { diagnosticSentences, diagnosticWords } from "@/data/diagnostic";
import { useI18n } from "@/i18n";
import { useRepos } from "@/repositories/provider";
import { Page, LoadingBlock } from "@/components/page";
import { Button } from "@/components/ui/button";
import { TypingRun } from "@/features/typing/typing-run";
import { textForTest } from "@/features/typing/content";
import { useSaveTypingResult } from "@/features/typing/use-save-result";
import { DictationCard } from "@/features/spelling/dictation-card";
import type { FinishedSession } from "@/features/typing/use-typing-session";

type Step = "intro" | "typing" | "spelling" | "sentences" | "result";

const PLAN_LINKS: Record<PlanStep, string> = {
  foundation: "/learn/lesson/home-row",
  typing: "/practice",
  spelling: "/spelling",
  sentences: "/sentences",
  professional: "/professional",
};

export default function DiagnosticPage() {
  const { t, num, pct } = useI18n();
  const repos = useRepos();
  const saveTyping = useSaveTypingResult();
  const [step, setStep] = useState<Step>("intro");
  const [typingText, setTypingText] = useState<string | null>(null);
  const begin = () => {
    setTypingText(textForTest("sentences", 60, seededRng(Date.now()), "A1").text);
    setStep("typing");
  };
  const [typing, setTyping] = useState<{ wpm: number; accuracy: number } | null>(null);
  const [wordIndex, setWordIndex] = useState(0);
  const [spellingCorrect, setSpellingCorrect] = useState(0);
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [sentenceScores, setSentenceScores] = useState<number[]>([]);
  const [result, setResult] = useState<{ level: CefrLevel; plan: PlanStep[] } | null>(null);

  const onTypingDone = useCallback(
    (s: FinishedSession) => {
      setTyping({ wpm: s.metrics.netWpm, accuracy: s.metrics.accuracy });
      void saveTyping(s, "diagnostic", 60);
      setStep("spelling");
    },
    [saveTyping],
  );

  const finish = useCallback(
    async (scores: number[]) => {
      const input = {
        wpm: typing?.wpm ?? 0,
        accuracy: typing?.accuracy ?? 0,
        spellingCorrect,
        spellingTotal: diagnosticWords.length,
        sentenceScores: scores,
      };
      const level = placeLevel(input);
      const plan = buildPlan(input);
      await repos.profile.save({ level, plan, diagnosticAt: Date.now() });
      await repos.activity.log("diagnostic", 120, 20 + scores.reduce((a, s) => a + xpFor({ kind: "sentence", score: s }), 0));
      setResult({ level, plan });
      setStep("result");
    },
    [typing, spellingCorrect, repos],
  );

  const stepNumber = { intro: 0, typing: 1, spelling: 2, sentences: 3, result: 3 }[step];
  const word = diagnosticWords[wordIndex];
  const sentence = diagnosticSentences[sentenceIndex];

  return (
    <Page title={t.diagnostic.title} intro={step === "intro" ? t.diagnostic.intro : undefined} width="narrow">
      {step !== "intro" && step !== "result" && (
        <div className="mb-6 space-y-2">
          <p className="text-sm text-ink-soft">
            {t.diagnostic.step(stepNumber, 3)} ·{" "}
            {step === "typing" ? t.diagnostic.typingStep : step === "spelling" ? t.diagnostic.spellingStep : t.diagnostic.sentenceStep}
          </p>
          <div className="h-1 rounded-full bg-rule" role="presentation">
            <div className="h-full rounded-full bg-brass-fill transition-[width]" style={{ width: `${(stepNumber / 3) * 100}%` }} />
          </div>
        </div>
      )}

      {step === "intro" && (
        <div className="space-y-6">
          <ol className="space-y-3">
            {[t.diagnostic.typingStep, t.diagnostic.spellingStep, t.diagnostic.sentenceStep].map((s, i) => (
              <li key={s} className="flex items-center gap-3">
                <span className="grid size-8 place-items-center rounded-full border border-rule-strong text-sm tabular">{num(i + 1)}</span>
                {s}
              </li>
            ))}
          </ol>
          <p className="text-sm text-ink-soft">{t.diagnostic.note}</p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" className="h-11 px-6" onClick={begin}>
              {t.diagnostic.begin}
            </Button>
            <Button asChild variant="ghost" size="lg" className="h-11">
              <Link href="/practice">{t.diagnostic.later}</Link>
            </Button>
          </div>
        </div>
      )}

      {step === "typing" &&
        (typingText ? <TypingRun target={typingText} durationSec={60} onFinish={onTypingDone} /> : <LoadingBlock label={t.common.loading} />)}

      {step === "spelling" && word && (
        <div className="space-y-3">
          <p className="text-sm text-ink-soft">
            {t.diagnostic.spellingPrompt} {num(wordIndex + 1)} / {num(diagnosticWords.length)}
          </p>
          <DictationCard
            key={word.id}
            word={word}
            showFeedback={false}
            onAnswer={(a) => {
              if (a.correct) setSpellingCorrect((c) => c + 1);
            }}
            onNext={() => {
              if (wordIndex + 1 < diagnosticWords.length) setWordIndex((i) => i + 1);
              else setStep("sentences");
            }}
          />
        </div>
      )}

      {step === "sentences" && sentence && (
        <SentencePrompt
          key={sentence.id}
          ar={sentence.ar}
          label={`${t.diagnostic.sentencePrompt} ${num(sentenceIndex + 1)} / ${num(diagnosticSentences.length)}`}
          onSubmit={(answer) => {
            const score = gradeSentence(answer, sentence.en).score;
            const scores = [...sentenceScores, score];
            setSentenceScores(scores);
            if (sentenceIndex + 1 < diagnosticSentences.length) setSentenceIndex((i) => i + 1);
            else void finish(scores);
          }}
        />
      )}

      {step === "result" && result && (
        <section aria-labelledby="diag-result" className="space-y-8">
          <div>
            <h2 id="diag-result" className="text-sm text-ink-soft">
              {t.diagnostic.resultTitle}
            </h2>
            <p className="font-latin-display text-6xl font-medium">
              {result.level}
            </p>
            <p className="text-ink-soft">{t.common.levels[result.level]}</p>
          </div>
          <dl className="grid grid-cols-3 gap-4 tabular">
            <div>
              <dt className="text-xs text-ink-soft">{t.common.wpmShort}</dt>
              <dd className="text-xl font-semibold">{num(Math.round(typing?.wpm ?? 0))}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-soft">{t.nav.spelling}</dt>
              <dd className="text-xl font-semibold">
                {num(spellingCorrect)} / {num(diagnosticWords.length)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-soft">{t.nav.sentences}</dt>
              <dd className="text-xl font-semibold">{pct((sentenceScores.reduce((a, b) => a + b, 0) / Math.max(1, sentenceScores.length)) * 100)}</dd>
            </div>
          </dl>
          <div>
            <h3 className="mb-3 text-lg font-semibold">{t.diagnostic.planTitle}</h3>
            <ol className="space-y-2">
              {result.plan.map((p, i) => (
                <li key={p} className="flex items-center gap-3">
                  <span className="grid size-7 place-items-center rounded-full bg-brass-wash text-sm tabular">{num(i + 1)}</span>
                  <Link href={PLAN_LINKS[p]} className="underline-offset-4 hover:underline">
                    {t.diagnostic.plan[p]}
                  </Link>
                </li>
              ))}
            </ol>
          </div>
          <p className="text-sm text-ink-soft">{t.diagnostic.note}</p>
          <Button asChild size="lg" className="h-11 px-6">
            <Link href={PLAN_LINKS[result.plan[0] ?? "typing"]}>{t.diagnostic.goPlan}</Link>
          </Button>
        </section>
      )}
    </Page>
  );
}

function SentencePrompt({ ar, label, onSubmit }: { ar: string; label: string; onSubmit: (answer: string) => void }) {
  const { t } = useI18n();
  const [value, setValue] = useState("");
  const id = useId();
  return (
    <form
      className="sheet space-y-4 p-6 sm:p-8"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSubmit(value);
      }}
    >
      <p className="text-sm text-ink-soft">{label}</p>
      <p lang="ar" dir="rtl" className="font-arabic text-2xl leading-relaxed font-semibold">
        {ar}
      </p>
      <label htmlFor={id} className="sr-only">
        {t.sentences.inputLabel}
      </label>
      <textarea
        id={id}
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        dir="ltr"
        lang="en"
        rows={2}
        maxLength={300}
        autoCapitalize="sentences"
        spellCheck={false}
        className="w-full resize-none rounded-lg border border-input bg-paper p-3 font-mono text-lg focus:border-brass-fill"
      />
      <Button type="submit" size="lg" className="h-11 px-6" disabled={!value.trim()}>
        {t.common.next}
      </Button>
    </form>
  );
}
