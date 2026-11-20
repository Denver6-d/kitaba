"use client";

import { useEffect, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { spellingWordById } from "@/data/words";
import type { SpellingWord } from "@/data/schema";
import { CATEGORY_INFO } from "@/data/rules";
import { checkAnswer, expectedSpelling } from "@/domain/spelling/check";
import { letterDiff } from "@/domain/spelling/diff";
import { useI18n } from "@/i18n";
import { useSettings } from "@/lib/settings-store";
import { prefersReducedMotion } from "@/lib/settings";
import { useSpeech } from "@/lib/speech";
import { Button } from "@/components/ui/button";
import { AudioButton } from "@/features/games/ui/audio-button";
import { LetterBoxes } from "@/features/games/ui/letter-boxes";
import { AnswerMarks, CorrectionHeader, CorrectLine } from "@/features/games/ui/correction";
import { RuleCard } from "@/features/games/ui/rule-card";

/**
 * The landing page's live mini game (DESIGN.md V3, landing). It opens with a
 * demo: a typical mistake ("recieve") types itself letter by letter and the
 * correction with its mint rule card appears. "Try it yourself" then turns it
 * into a real round on the same components the game uses: listen, type, check.
 */
const DEMO = { id: "w-receive", typo: "recieve" } as const;
const ROUND_IDS = ["w-necessary", "w-knife", "w-separate", "w-beautiful", "w-people"] as const;
const TYPE_MS = 110;

type Phase = { readonly kind: "demo"; readonly typed: string } | { readonly kind: "play"; readonly n: number; readonly answer: string | null };

const wordFor = (id: string): SpellingWord | undefined => spellingWordById.get(id);

export function MiniGame() {
  const { t, lang } = useI18n();
  const [settings] = useSettings();
  const { status, speak } = useSpeech();
  const [phase, setPhase] = useState<Phase>({ kind: "demo", typed: "" });
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  // The demo waits until the card is on screen (on phones it sits below the hero).
  const [seen, setSeen] = useState(false);
  const inputId = useId();
  const liveId = useId();

  useEffect(() => {
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      const id = window.setTimeout(() => setSeen(true), 0);
      return () => window.clearTimeout(id);
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setSeen(true);
        io.disconnect();
      }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // The demo types itself once; with reduced motion it is simply complete.
  useEffect(() => {
    if (!seen || phase.kind !== "demo" || phase.typed === DEMO.typo) return;
    const still = prefersReducedMotion();
    const id = window.setTimeout(
      () => setPhase({ kind: "demo", typed: still ? DEMO.typo : DEMO.typo.slice(0, phase.typed.length + 1) }),
      still ? 0 : phase.typed === "" ? 900 : TYPE_MS,
    );
    return () => window.clearTimeout(id);
  }, [phase, seen]);

  // After Check the form unmounts: move focus to the next action, so keyboard and screen-reader users keep their place.
  const playAnswered = phase.kind === "play" && phase.answer !== null;
  useEffect(() => {
    if (playAnswered) nextRef.current?.focus({ preventScroll: true });
  }, [playAnswered]);

  const word = wordFor(phase.kind === "demo" ? DEMO.id : (ROUND_IDS[phase.n % ROUND_IDS.length] ?? DEMO.id));
  if (!word) return null;
  const expected = expectedSpelling(word, settings.accent);
  const canSpeak = status === "ready";
  const info = CATEGORY_INFO[word.category];

  const answered = phase.kind === "demo" ? phase.typed === DEMO.typo : phase.answer !== null;
  const answer = phase.kind === "demo" ? phase.typed : (phase.answer ?? value);
  const check = answered ? checkAnswer({ word: word.word, ...(word.uk ? { uk: word.uk } : {}), category: word.category }, answer, settings.accent) : null;
  const correct = check?.accepted ?? false;

  const start = (n: number) => {
    // Render the field now and focus it inside the same tap: iOS opens the keyboard only then.
    flushSync(() => {
      setValue("");
      setPhase({ kind: "play", n, answer: null });
    });
    inputRef.current?.focus({ preventScroll: true });
  };

  return (
    <section ref={cardRef} aria-label={t.home.demoLabel} className="panel space-y-6 p-5 sm:p-8">
      <p id={liveId} className="sr-only" aria-live="polite">
        {phase.kind === "play" && answered ? (
          correct ? (
            t.game.correct
          ) : (
            <>
              {t.game.wrong}:{" "}
              <span lang="en" dir="ltr">
                {expected}
              </span>
            </>
          )
        ) : null}
      </p>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="text-sm text-fg-2">{phase.kind === "demo" ? t.home.demoExample : t.home.demoLabel}</p>
          {word.ar && (
            <p className="text-lg">
              <span className="text-fg-3">{t.game.hint}: </span>
              <span lang="ar">{word.ar}</span>
            </p>
          )}
        </div>
        {canSpeak && <AudioButton size="sm" label={t.game.listen} onPlay={() => speak(expected)} ringing={false} onMouseDown={(e) => e.preventDefault()} />}
      </div>

      {(phase.kind === "play" && !answered) || (phase.kind === "demo" && !answered) ? (
        <LetterBoxes value={phase.kind === "demo" ? phase.typed : value} />
      ) : null}

      {phase.kind === "play" && !answered && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim() !== "") setPhase({ kind: "play", n: phase.n, answer: value });
          }}
        >
          <label htmlFor={inputId} className="block text-sm font-medium text-fg-2">
            {t.game.typeHere}
          </label>
          <input
            ref={inputRef}
            id={inputId}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            dir="ltr"
            lang="en"
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="go"
            maxLength={40}
            className="h-14 w-full min-w-0 rounded-field border-2 border-line-strong bg-canvas px-4 font-word text-2xl outline-none transition-colors hover:border-fg-3 focus:border-gold"
          />
          {/* The hero holds this screen's gold button, so the demo's Check is an outline pill. */}
          <Button type="submit" variant="outline" disabled={value.trim() === ""} onMouseDown={(e) => e.preventDefault()} className="w-full sm:w-auto">
            {t.game.check}
          </Button>
        </form>
      )}

      {answered && check && (
        <div className="space-y-5">
          {correct ? (
            <CorrectLine text={t.game.correct} />
          ) : (
            <>
              <div className="space-y-1">
                <p className="text-sm text-fg-2">{t.game.youWrote}</p>
                <AnswerMarks segments={letterDiff(answer.trim().toLowerCase(), expected)} labels={t.game.marks} />
              </div>
              <CorrectionHeader
                label={t.game.wrong}
                segments={letterDiff(answer.trim().toLowerCase(), expected)}
                word={expected}
                keyLabel={t.game.keyLetter}
                listenLabel={t.game.listenCorrect}
                onListen={canSpeak ? () => speak(expected, 0.85) : null}
              />
              <RuleCard
                label={t.game.rule}
                title={info.label[lang]}
                rule={info.rule[lang]}
                trickLabel={t.game.trick}
                trick={info.trick[lang]}
                exampleLabel={t.game.exampleLabel}
                example={word.example}
                headingLevel={2}
              />
            </>
          )}
          <Button ref={nextRef} type="button" variant="outline" onClick={() => start(phase.kind === "demo" ? 0 : phase.n + 1)} className="w-full sm:w-auto">
            {phase.kind === "demo" ? t.home.tryYourself : t.home.demoNext}
          </Button>
        </div>
      )}
    </section>
  );
}
