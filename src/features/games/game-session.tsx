"use client";

import { useCallback, useEffect, useId, useReducer, useRef, useState, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import { Eye, Turtle, Volume2 } from "lucide-react";
import type { SpellingWord } from "@/data/schema";
import { CATEGORY_INFO } from "@/data/rules";
import { createGame, currentItem, isAnswered, reduceGame, remainingMs, type GameConfig, type GameItem, type GameState } from "@/domain/games/engine";
import { multiplierFor } from "@/domain/games/engine";
import { sentenceMatches } from "@/domain/games/items";
import { checkAnswer, type CheckResult } from "@/domain/spelling/check";
import { useI18n } from "@/i18n";
import { useSpeech } from "@/lib/speech";
import { useSettings } from "@/lib/settings-store";
import { playTone } from "@/lib/sound";
import { SpellingInput, useAnswerInput } from "@/components/spelling-input";
import { reduceAnswerInput, type AnswerInputEvent } from "@/domain/spelling/answer-input";
import { Button } from "@/components/ui/button";
import { LetterDiff } from "./letter-diff";
import { useRecordAnswer } from "./use-record-answer";

interface Verdict {
  readonly itemKey: string;
  readonly correct: boolean;
  readonly check: CheckResult | null;
  readonly answer: string;
  readonly nextReviewDays: number | null;
}

interface Props {
  readonly items: readonly GameItem[];
  readonly config: GameConfig;
  readonly words: ReadonlyMap<string, SpellingWord>;
  readonly onFinish: (state: GameState) => void;
  /** Label shown above the play area (mode or stage name). */
  readonly title: string;
  /** Whether to show the Arabic meaning for a word in listen-like items (hints fade with mastery). */
  readonly showMeaning: (wordId: string) => boolean;
}

const TICK_MS = 250;

/**
 * Buttons around the answer field must not take focus from it: a click (or a
 * tap, which would also close the phone keyboard) would otherwise leave focus
 * on a button that then unmounts, and the next word's first letter would be lost.
 */
const keepInputFocus = (e: MouseEvent) => e.preventDefault();

const takesTyping = (item: GameItem | undefined) => item !== undefined && (item.kind === "typed" || item.kind === "sentence");

/**
 * Plays one session. The engine (domain/games/engine.ts) keeps score; this
 * component renders the current item and keeps a single SpellingInput mounted
 * across typed items (DECISIONS B1), so focus and the first keystroke are
 * never lost between words.
 */
export function GameSession({ items, config, words, onFinish, title, showMeaning }: Props) {
  const { t, lang, num } = useI18n();
  const [settings] = useSettings();
  const { status: voice, speak, usingOtherAccent } = useSpeech();
  const record = useRecordAnswer();
  const [game, dispatch] = useReducer(reduceGame, null, () => createGame(items, config));
  const first = items[0];
  const input = useAnswerInput(first?.key ?? "none");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [fixPick, setFixPick] = useState<number | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [now, setNow] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const finishedRef = useRef(false);
  const liveId = useId();

  const item = currentItem(game);
  const timed = config.durationMs !== null;
  const word = item ? words.get(item.wordId) : undefined;
  const answered = item ? isAnswered(game, item.key) : false;

  // Untimed sessions start when they appear; timed ones start from their Start button.
  useEffect(() => {
    if (!timed) dispatch({ type: "start", t: performance.now() });
  }, [timed]);

  // Clock for timed rounds (also ends the round when time runs out).
  useEffect(() => {
    if (!timed || game.startedAt === null || game.finishedAt !== null) return;
    const id = window.setInterval(() => {
      const t = performance.now();
      setNow(t);
      dispatch({ type: "tick", t });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [timed, game.startedAt, game.finishedAt]);

  useEffect(() => {
    if (game.finishedAt !== null && !finishedRef.current) {
      finishedRef.current = true;
      onFinish(game);
    }
  }, [game, onFinish]);

  // Speak each new spoken item once the voice is ready.
  const speakText = item?.speak && (item.kind !== "fix" || answered) ? item.speak : undefined;
  const autoSpeak = item && (item.mode === "listen" || item.mode === "bee" || item.mode === "review" || item.kind === "sentence");
  useEffect(() => {
    if (voice === "ready" && autoSpeak && speakText && (!timed || game.startedAt !== null)) speak(speakText);
    // Only when the item (or voice readiness) changes; replay is a button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.key, voice, game.startedAt]);

  useEffect(() => {
    if (!revealing) return;
    const id = window.setTimeout(() => {
      setRevealing(false);
      inputRef.current?.focus();
    }, 2000);
    return () => window.clearTimeout(id);
  }, [revealing]);

  const goNext = useCallback(() => {
    if (!item || !answered) return;
    const t = performance.now();
    const following = game.items[game.index + 1];
    dispatch({ type: "next", t });
    // Same event: the input's value is cleared in the same update that changes the item.
    // Letters typed during feedback carry over only into an item that takes typing.
    if (following) input.dispatch(takesTyping(following) ? { type: "item", itemKey: following.key, t } : { type: "item", itemKey: following.key, carry: "", t });
    setVerdict(null);
    setFixPick(null);
    setRevealed(false);
    setRevealing(false);
    // Still inside the user's gesture, so phones keep (or open) the keyboard.
    if (takesTyping(following)) inputRef.current?.focus({ preventScroll: true });
  }, [item, answered, game.items, game.index, input]);

  // Typing while a verdict is showing moves on and keeps the typed letters: the
  // input reducer stores them, and the "item" event carries them to the next word.
  const onInputEvent = (ev: AnswerInputEvent) => {
    input.dispatch(ev);
    if (answered && (ev.type === "change" || ev.type === "compositionend") && reduceAnswerInput(input.state, ev).advanceRequested) goNext();
  };

  const submit = useCallback(
    (answerText: string, opts?: { forcedWrong?: boolean }) => {
      if (!item || answered || !word) return;
      const t = performance.now();
      let correct: boolean;
      let check: CheckResult | null = null;
      if (item.kind === "sentence") {
        correct = !opts?.forcedWrong && sentenceMatches(answerText, item.answer);
      } else {
        check = checkAnswer({ word: word.word, ...(word.uk ? { uk: word.uk } : {}), category: word.category }, answerText, settings.accent);
        correct = !opts?.forcedWrong && check.accepted;
      }
      if (item.kind === "fix" && fixPick !== item.wrongIndex) correct = false;
      dispatch({ type: "answer", itemKey: item.key, correct, answer: answerText, t });
      input.markChecked();
      if (settings.sounds) playTone(correct ? "correct" : "wrong");
      const v: Verdict = { itemKey: item.key, correct, check, answer: answerText, nextReviewDays: null };
      setVerdict(v);
      if (item.kind !== "sentence") {
        void record({ wordId: item.wordId, expected: item.answer, answer: answerText, correct, revealed })
          .then((days) => setVerdict((cur) => (cur && cur.itemKey === v.itemKey ? { ...cur, nextReviewDays: days } : cur)))
          .catch(() => undefined);
      }
      // Choice and fix-pick answers come from buttons: move focus to Next so Enter continues.
      if (item.kind === "choice") window.setTimeout(() => nextRef.current?.focus(), 0);
    },
    [item, answered, word, settings.accent, settings.sounds, fixPick, input, record, revealed],
  );

  const onEnter = () => {
    if (answered) goNext();
    else if (input.state.value.trim() !== "") submit(input.state.value);
  };

  // Keyboard shortcuts for choice items: 1–4 pick, Enter continues.
  useEffect(() => {
    if (!item || item.kind !== "choice") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const n = Number(e.key);
      if (!answered && n >= 1 && n <= (item.options?.length ?? 0)) {
        e.preventDefault();
        submit(item.options?.[n - 1] ?? "");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, answered, submit]);

  if (!item || !word) return null;

  const left = remainingMs(game, Math.max(now, game.startedAt ?? 0));
  const notStarted = timed && game.startedAt === null;
  const showInput = item.kind === "typed" || item.kind === "sentence" || (item.kind === "fix" && fixPick !== null);
  const mult = multiplierFor(game.combo);
  const info = CATEGORY_INFO[word.category];
  const canSpeak = voice === "ready";
  const listenLike = item.mode === "listen" || item.mode === "bee" || item.mode === "review" || item.kind === "sentence";

  return (
    <section aria-label={t.game.areaLabel} className="sheet relative space-y-6 p-5 sm:p-8">
      {/* Always mounted, so screen readers announce each verdict when its text changes. */}
      <p id={liveId} className="sr-only" aria-live="polite">
        {verdict ? (verdict.correct ? t.game.correct : `${t.game.wrong}: ${item.answer}`) : ""}
      </p>

      <header className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-3">
          <span className="font-semibold">{title}</span>
          {!timed && (
            <span className="text-ink-soft tabular">{t.game.itemOf(game.index + 1, game.items.length)}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {game.combo >= 3 && (
            <span className="rounded-full bg-brass-wash px-2.5 py-1 font-semibold text-brass tabular" aria-label={t.game.comboLabel(mult)}>
              {t.game.combo(mult)}
            </span>
          )}
          <span className="rounded-full border border-rule px-2.5 py-1 tabular" aria-label={t.game.score}>
            {num(game.points)}
          </span>
          {timed && left !== null && (
            <span
              className={`rounded-full px-2.5 py-1 font-semibold tabular ${left < 10_000 ? "bg-[var(--error-wash)] text-error" : "bg-muted"}`}
              aria-label={t.game.timeLeft}
              role="timer"
            >
              {num(Math.ceil(left / 1000))}
              {t.common.seconds}
            </span>
          )}
        </div>
      </header>

      {!timed && (
        <div className="h-1 overflow-hidden rounded-full bg-rule" aria-hidden="true">
          <div className="h-full rounded-full bg-brass-fill transition-[width] duration-300" style={{ width: `${(game.results.length / game.items.length) * 100}%` }} />
        </div>
      )}

      {notStarted ? (
        <div className="space-y-4 py-6 text-center">
          <p className="text-ink-soft">{t.modes[item.mode]?.desc}</p>
          <Button
            size="lg"
            className="h-12 px-8 text-base"
            onClick={() => {
              // Render the input now, then focus it inside the same tap (iOS opens the keyboard only then).
              flushSync(() => dispatch({ type: "start", t: performance.now() }));
              inputRef.current?.focus();
            }}
          >
            {t.common.start}
          </Button>
        </div>
      ) : (
        <>
          <Prompt
            item={item}
            word={word}
            fixPick={fixPick}
            answered={answered}
            onPickToken={(i) => {
              if (fixPick === null) setFixPick(i);
            }}
            labels={{ fix: t.game.fixPrompt, fixWrong: t.game.fixWrongPick, missing: t.game.missingPrompt, scramble: t.game.scramblePrompt, choice: t.game.choicePrompt, sentence: t.game.sentencePrompt, meaning: t.game.meaning }}
            lang={lang}
            revealing={revealing}
            meaningShown={showMeaning(item.wordId) || answered}
          />

          {listenLike && (
            <div className="flex flex-wrap items-center gap-2">
              {canSpeak ? (
                <>
                  <Button size="lg" variant="secondary" onMouseDown={keepInputFocus} onClick={() => item.speak && speak(item.speak)} className="h-11 gap-2 px-5">
                    <Volume2 className="size-5" aria-hidden="true" />
                    {t.game.listen}
                  </Button>
                  <Button variant="outline" size="lg" onMouseDown={keepInputFocus} onClick={() => speak(item.answer, 0.6)} className="h-11 gap-2">
                    <Turtle className="size-4" aria-hidden="true" />
                    {t.game.slow}
                  </Button>
                  {item.kind !== "sentence" && (
                    <Button variant="ghost" size="lg" onMouseDown={keepInputFocus} onClick={() => speak(word.example)} className="h-11">
                      {t.game.example}
                    </Button>
                  )}
                </>
              ) : voice === "checking" ? (
                <p className="text-sm text-ink-soft">{t.common.loading}</p>
              ) : (
                <div className="w-full space-y-3">
                  <p role="note" className="rounded-lg bg-brass-wash p-3 text-sm">
                    {t.game.noVoice}
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setRevealed(true);
                      setRevealing(true);
                    }}
                    disabled={revealing || answered}
                    className="h-11 gap-2"
                  >
                    <Eye className="size-4" aria-hidden="true" />
                    {t.game.showWord}
                  </Button>
                </div>
              )}
              {canSpeak && usingOtherAccent && <p className="w-full text-sm text-ink-soft">{t.game.otherAccent}</p>}
            </div>
          )}

          {item.kind === "choice" && (
            <ChoiceOptions item={item} answered={answered} picked={verdict?.answer ?? null} onPick={(o) => submit(o)} hint={t.game.choiceKeys} />
          )}

          {showInput && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onEnter();
              }}
              className="space-y-2"
            >
              {item.kind === "fix" && <p className="text-sm font-medium">{t.game.fixType}</p>}
              <SpellingInput
                ref={inputRef}
                state={input.state}
                dispatch={onInputEvent}
                onEnter={onEnter}
                label={item.kind === "sentence" ? t.game.typeSentence : t.game.typeHere}
                tone={verdict ? (verdict.correct ? "correct" : "wrong") : "idle"}
                describedBy={liveId}
                size={item.kind === "sentence" ? "md" : "lg"}
                // The input is mounted again only when switching between item kinds (mixed rounds).
                autoFocus
              />
            </form>
          )}

          {verdict && <Feedback verdict={verdict} item={item} word={word} rule={info.rule[lang]} category={info.label[lang]} />}

          {(answered || showInput) && (
          <div className="flex flex-wrap items-center gap-3 max-sm:sticky max-sm:bottom-0 max-sm:-mx-5 max-sm:border-t max-sm:border-rule max-sm:bg-sheet max-sm:px-5 max-sm:py-3">
            {answered ? (
              <Button ref={nextRef} size="lg" onMouseDown={showInput ? keepInputFocus : undefined} onClick={goNext} className="h-12 flex-1 px-8 text-base sm:flex-none">
                {game.index + 1 >= game.items.length ? t.game.finish : t.game.next}
              </Button>
            ) : (
              showInput && (
                <>
                  <Button
                    size="lg"
                    onMouseDown={keepInputFocus}
                    onClick={onEnter}
                    disabled={input.state.value.trim() === ""}
                    className="h-12 flex-1 px-8 text-base sm:flex-none"
                  >
                    {t.game.check}
                  </Button>
                  <Button variant="ghost" size="lg" onMouseDown={keepInputFocus} onClick={() => submit("", { forcedWrong: true })} className="h-12">
                    {t.game.dontKnow}
                  </Button>
                </>
              )
            )}
            {answered && showInput && <p className="text-sm text-ink-soft max-sm:hidden">{t.game.pressEnter}</p>}
          </div>
          )}
        </>
      )}
    </section>
  );
}

function Prompt({
  item,
  word,
  fixPick,
  answered,
  onPickToken,
  labels,
  lang,
  revealing,
  meaningShown,
}: {
  item: GameItem;
  word: SpellingWord;
  fixPick: number | null;
  answered: boolean;
  onPickToken: (i: number) => void;
  labels: Record<"fix" | "fixWrong" | "missing" | "scramble" | "choice" | "sentence" | "meaning", string>;
  lang: "ar" | "en";
  revealing: boolean;
  meaningShown: boolean;
}) {
  const meaning = (
    <p className="text-hint">
      {labels.meaning}: <span lang="ar">{word.ar}</span>
    </p>
  );
  if (revealing) {
    return (
      <p dir="ltr" lang="en" aria-live="polite" className="ruled py-2 font-mono text-4xl">
        {item.kind === "sentence" ? item.answer : item.answer}
      </p>
    );
  }
  switch (item.kind) {
    case "fix":
      return (
        <div className="space-y-3">
          <p className="text-sm font-medium">{labels.fix}</p>
          <p dir="ltr" lang="en" className="flex flex-wrap gap-x-1.5 gap-y-2 text-xl leading-relaxed sm:text-2xl">
            {(item.tokens ?? []).map((tok, i) => {
              const isWrong = i === item.wrongIndex;
              const picked = fixPick === i;
              const reveal = fixPick !== null && isWrong;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => onPickToken(i)}
                  disabled={fixPick !== null || answered}
                  aria-pressed={picked}
                  className={`min-h-11 rounded-md px-1.5 transition-colors ${
                    reveal ? "bg-[var(--error-wash)] text-error underline decoration-wavy decoration-error underline-offset-4" : picked ? "bg-muted" : "hover:bg-muted"
                  }`}
                >
                  {tok}
                </button>
              );
            })}
          </p>
          {fixPick !== null && fixPick !== item.wrongIndex && <p className="text-sm text-error">{labels.fixWrong}</p>}
        </div>
      );
    case "choice":
      return (
        <div className="space-y-2">
          <p className="text-sm font-medium">{labels.choice}</p>
          {item.context && (
            <p dir="ltr" lang="en" className="text-xl">
              {item.context}
            </p>
          )}
          {meaning}
        </div>
      );
    case "sentence":
      return <p className="text-sm font-medium">{labels.sentence}</p>;
    case "typed":
      if (item.masked) {
        return (
          <div className="space-y-2">
            <p className="text-sm font-medium">{labels.missing}</p>
            <p dir="ltr" lang="en" className="ruled py-1 font-mono text-4xl tracking-[0.25em] sm:text-5xl" aria-label={item.masked.replace(/_/g, " blank ")}>
              {item.masked}
            </p>
            {meaning}
          </div>
        );
      }
      if (item.letters) {
        return (
          <div className="space-y-3">
            <p className="text-sm font-medium">{labels.scramble}</p>
            <ul dir="ltr" lang="en" className="flex flex-wrap gap-2" aria-label={item.letters.join(" ")}>
              {item.letters.map((l, i) => (
                <li key={i} className="grid size-12 place-items-center rounded-[10px] border border-rule-strong bg-paper font-mono text-2xl uppercase shadow-sm">
                  {l}
                </li>
              ))}
            </ul>
            {meaning}
          </div>
        );
      }
      return meaningShown ? <div lang={lang}>{meaning}</div> : null;
  }
}

function ChoiceOptions({ item, answered, picked, onPick, hint }: { item: GameItem; answered: boolean; picked: string | null; onPick: (o: string) => void; hint: string }) {
  return (
    <div className="space-y-2">
      <ul className="grid gap-3 sm:grid-cols-2" dir="ltr" lang="en">
        {(item.options ?? []).map((o, i) => {
          const isAnswer = o === item.answer;
          const state = !answered ? "idle" : isAnswer ? "right" : o === picked ? "wrong" : "dim";
          return (
            <li key={o}>
              <button
                type="button"
                onClick={() => onPick(o)}
                disabled={answered}
                className={`flex min-h-14 w-full items-center gap-3 rounded-[10px] border-2 px-4 text-start font-mono text-xl transition-colors ${
                  state === "right"
                    ? "border-correct bg-[var(--correct-wash)] text-correct"
                    : state === "wrong"
                      ? "border-error bg-[var(--error-wash)] text-error line-through"
                      : state === "dim"
                        ? "border-rule opacity-60"
                        : "border-rule-strong bg-paper hover:border-brass-fill"
                }`}
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted font-sans text-sm text-ink-soft">{i + 1}</span>
                {o}
              </button>
            </li>
          );
        })}
      </ul>
      {!answered && <p className="text-sm text-ink-soft max-sm:hidden">{hint}</p>}
    </div>
  );
}

function Feedback({ verdict, item, word, rule, category }: { verdict: Verdict; item: GameItem; word: SpellingWord; rule: string; category: string }) {
  const { t } = useI18n();
  const v = verdict.check?.verdict;
  return (
    <div className={`space-y-3 rounded-xl border-s-4 p-4 ${verdict.correct ? "border-correct bg-[var(--correct-wash)]" : "border-error bg-[var(--error-wash)]"}`}>
      {verdict.correct ? (
        <p className="answer-sweep inline-block pb-2 text-lg font-semibold text-correct">{v === "other-variant" ? t.game.otherVariant(item.answer) : t.game.correct}</p>
      ) : (
        <div className="space-y-2">
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-ink-soft">{t.game.wrong}</span>
            <strong dir="ltr" lang="en" className="font-mono text-2xl">
              {item.answer}
            </strong>
          </p>
          {verdict.answer.trim() !== "" && item.kind !== "choice" && verdict.check && verdict.check.diff.length > 0 && (
            <p className="flex flex-wrap items-baseline gap-x-3">
              <span className="text-sm text-ink-soft">{t.game.yourAnswer}</span>
              <LetterDiff segments={verdict.check.diff} labels={{ missing: "+", extra: "−", wrong: "≠" }} />
            </p>
          )}
        </div>
      )}
      {item.kind !== "sentence" && (
        <>
          <p className="text-hint">
            <span className="font-semibold">
              {t.game.rule} · {category}:
            </span>{" "}
            {rule}
          </p>
          <p className="text-sm text-ink-soft">
            <span lang="ar">{word.ar}</span> ·{" "}
            <span dir="ltr" lang="en">
              {word.example}
            </span>
          </p>
        </>
      )}
      {verdict.nextReviewDays !== null && <p className="text-sm text-hint">{t.review.nextReview(verdict.nextReviewDays)}</p>}
    </div>
  );
}
