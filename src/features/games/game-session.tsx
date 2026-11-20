"use client";

import { useKeyboardInset } from "@/lib/keyboard";
import { chipVariants } from "@/components/ui/chip";
import {
  useCallback,
  useEffect,
  useId,
  useReducer,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { flushSync } from "react-dom";
import { Check, Eye, Turtle } from "lucide-react";
import type { PlayWord } from "@/data/play-word";
import { TatoebaCreditLine } from "@/features/library/credit-line";
import { CATEGORY_INFO, trickFor, type CategoryInfo } from "@/data/rules";
import {
  createGame,
  currentItem,
  isAnswered,
  reduceGame,
  remainingMs,
  type GameConfig,
  type GameItem,
  type GameState,
} from "@/domain/games/engine";
import { multiplierFor } from "@/domain/games/engine";
import { sentenceMatches } from "@/domain/games/items";
import { checkAnswer, type CheckResult } from "@/domain/spelling/check";
import { useI18n } from "@/i18n";
import { useSpeech } from "@/lib/speech";
import { useSettings } from "@/lib/settings-store";
import { giveFeedback } from "@/lib/feedback";
import { pressActivates, type Press } from "@/lib/press";
import { SpellingInput, useAnswerInput } from "@/components/spelling-input";
import {
  reduceAnswerInput,
  type AnswerInputEvent,
} from "@/domain/spelling/answer-input";
import { Button } from "@/components/ui/button";
import { AudioButton } from "./ui/audio-button";
import { LetterBoxes } from "./ui/letter-boxes";
import { GameHeading, GameTopBar } from "./ui/game-top-bar";
import { RuleCard } from "./ui/rule-card";
import { HintLine } from "./ui/hint-line";
import { hintFor } from "@/domain/spelling/hint";
import { AnswerMarks, CorrectionHeader, CorrectLine } from "./ui/correction";
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
  readonly words: ReadonlyMap<string, PlayWord>;
  readonly onFinish: (state: GameState) => void;
  /** Label shown above the play area (mode or stage name). */
  readonly title: string;
  /** Whether to show the Arabic meaning for a word in listen-like items (hints fade with mastery). */
  readonly showMeaning: (wordId: string) => boolean;
  /** The learner level this session was built for, shown next to the title. */
  readonly level?: string | null;
  /** "World 3 / Stage 2" for campaign stages, shown under the title. */
  readonly meta?: string | null;
  /** Where the close button goes. */
  readonly exitHref?: string;
  readonly onExit?: (() => void) | undefined;
}

const TICK_MS = 250;

/**
 * Buttons around the answer field must not take focus from it: a click (or a
 * tap, which would also close the phone keyboard) would otherwise leave focus
 * on a button that then unmounts, and the next word's first letter would be lost.
 */
const keepInputFocus = (e: MouseEvent) => e.preventDefault();

const takesTyping = (item: GameItem | undefined) =>
  item !== undefined && (item.kind === "typed" || item.kind === "sentence");

/**
 * Plays one session. The engine (domain/games/engine.ts) keeps score; this
 * component renders the current item and keeps a single SpellingInput mounted
 * across typed items (DECISIONS B1), so focus and the first keystroke are
 * never lost between words.
 */
export function GameSession({
  items,
  config,
  words,
  onFinish,
  title,
  showMeaning,
  level = null,
  meta = null,
  exitHref = "/play",
  onExit,
}: Props) {
  const { t, lang, num } = useI18n();
  useKeyboardInset();
  const [settings] = useSettings();
  const { status: voice, speak, usingOtherAccent } = useSpeech();
  const record = useRecordAnswer();
  const [game, dispatch] = useReducer(reduceGame, null, () =>
    createGame(items, config),
  );
  const first = items[0];
  const input = useAnswerInput(first?.key ?? "none");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [fixPick, setFixPick] = useState<number | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [now, setNow] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  /** The last press on Next, so a release beside a button that moved still counts (DECISIONS M2). */
  const nextPressRef = useRef<Press | null>(null);
  /** The click event the window listener already turned into "next", so Next's own onClick skips it. */
  const handledClickRef = useRef<Event | null>(null);
  const goNextRef = useRef<() => void>(() => undefined);
  const answeredKeyRef = useRef<string | null>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const finishedRef = useRef(false);
  const liveId = useId();
  const headingId = useId();
  const inputId = useId();

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
  const speakText =
    item?.speak && (item.kind !== "fix" || answered) ? item.speak : undefined;
  const autoSpeak =
    item &&
    (item.mode === "listen" ||
      item.mode === "bee" ||
      item.mode === "review" ||
      item.kind === "sentence");
  useEffect(() => {
    if (
      voice === "ready" &&
      autoSpeak &&
      speakText &&
      (!timed || game.startedAt !== null)
    )
      speak(speakText);
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
    if (following)
      input.dispatch(
        takesTyping(following)
          ? { type: "item", itemKey: following.key, t }
          : { type: "item", itemKey: following.key, carry: "", t },
      );
    setVerdict(null);
    setFixPick(null);
    setRevealed(false);
    setRevealing(false);
    // Still inside the user's gesture, so phones keep (or open) the keyboard.
    if (takesTyping(following))
      inputRef.current?.focus({ preventScroll: true });
  }, [item, answered, game.items, game.index, input]);

  useEffect(() => {
    goNextRef.current = goNext;
    answeredKeyRef.current = item && answered ? item.key : null;
  });

  // "Next" can move under a still pointer between press and release (the review note arrives,
  // the pressed button shrinks, the phone's sticky bar follows the keyboard). The browser then
  // sends the click to an ancestor and Next did nothing. A press on Next that is released within
  // a finger's slop, for the same answered item, still moves on (DECISIONS M2).
  useEffect(() => {
    const onClick = (e: globalThis.MouseEvent) => {
      const press = nextPressRef.current;
      nextPressRef.current = null;
      if (pressActivates(press, { x: e.clientX, y: e.clientY, t: e.timeStamp }, answeredKeyRef.current)) {
        handledClickRef.current = e;
        // The press was for Next: the click must not also activate whatever ended up under the finger.
        e.preventDefault();
        e.stopPropagation();
        goNextRef.current();
      }
    };
    const onCancel = () => {
      nextPressRef.current = null;
    };
    window.addEventListener("click", onClick, true);
    window.addEventListener("pointercancel", onCancel, true);
    return () => {
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("pointercancel", onCancel, true);
    };
  }, []);

  // Typing while a verdict is showing moves on and keeps the typed letters: the
  // input reducer stores them, and the "item" event carries them to the next word.
  const onInputEvent = (ev: AnswerInputEvent) => {
    input.dispatch(ev);
    if (
      answered &&
      (ev.type === "change" || ev.type === "compositionend") &&
      reduceAnswerInput(input.state, ev).advanceRequested
    )
      goNext();
  };

  const submit = useCallback(
    (answerText: string, opts?: { forcedWrong?: boolean }) => {
      if (!item || answered || !word) return;
      const t = performance.now();
      let correct: boolean;
      let check: CheckResult | null = null;
      if (item.kind === "sentence") {
        correct =
          !opts?.forcedWrong && sentenceMatches(answerText, item.answer);
      } else {
        check = checkAnswer(
          {
            word: word.word,
            ...(word.uk ? { uk: word.uk } : {}),
            category: word.category,
          },
          answerText,
          settings.accent,
        );
        correct = !opts?.forcedWrong && check.accepted;
      }
      if (item.kind === "fix" && fixPick !== item.wrongIndex) correct = false;
      dispatch({
        type: "answer",
        itemKey: item.key,
        correct,
        answer: answerText,
        t,
      });
      input.markChecked();
      giveFeedback(correct ? "correct" : "wrong", settings);
      const v: Verdict = {
        itemKey: item.key,
        correct,
        check,
        answer: answerText,
        nextReviewDays: null,
      };
      setVerdict(v);
      if (item.kind !== "sentence") {
        void record({
          wordId: item.wordId,
          expected: item.answer,
          answer: answerText,
          correct,
          revealed,
        })
          .then((days) =>
            setVerdict((cur) =>
              cur && cur.itemKey === v.itemKey
                ? { ...cur, nextReviewDays: days }
                : cur,
            ),
          )
          .catch(() => undefined);
      }
      // Choice and fix-pick answers come from buttons: move focus to Next so Enter continues.
      if (item.kind === "choice")
        window.setTimeout(() => nextRef.current?.focus(), 0);
    },
    [
      item,
      answered,
      word,
      settings,
      fixPick,
      input,
      record,
      revealed,
    ],
  );

  const onEnter = () => {
    if (answered) goNext();
    else if (input.state.value.trim() !== "") submit(input.state.value);
  };

  // An item without a text field (choice, fix) gets focus on its first control, so
  // keyboard and screen-reader users land on the new item instead of <body>.
  useEffect(() => {
    if (!item || takesTyping(item) || (timed && game.startedAt === null))
      return;
    areaRef.current
      ?.querySelector<HTMLElement>("button:not([disabled])")
      ?.focus({ preventScroll: true });
    // Only when the item changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.key]);

  // Keyboard shortcuts for choice items: 1–4 pick, Enter continues.
  useEffect(() => {
    if (!item || item.kind !== "choice") return;
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
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
  const showInput =
    item.kind === "typed" ||
    item.kind === "sentence" ||
    (item.kind === "fix" && fixPick !== null);
  const mult = multiplierFor(game.combo);
  const info = CATEGORY_INFO[word.category];
  const canSpeak = voice === "ready";
  const listenLike =
    item.mode === "listen" ||
    item.mode === "bee" ||
    item.mode === "review" ||
    item.kind === "sentence";

  const progress = game.results.length / game.items.length;
  const itemLine = t.game.itemOf(game.index + 1, game.items.length);
  const typingStarted = input.state.value !== "";
  // After Check the field is cleared for the next word, and "You wrote" shows the answer instead.
  const showBoxes = showInput && item.kind !== "sentence" && !answered;
  const tone = verdict ? (verdict.correct ? "correct" : "wrong") : "idle";
  // Every game word has a hint (DECISIONS M4): its Arabic hint, or its example with the word hidden.
  const hint = hintFor(word);
  const meaningLine =
    hint && (item.kind === "typed" || (item.kind === "fix" && fixPick !== null)) && !item.masked && !item.letters && (showMeaning(item.wordId) || answered || voice !== "ready") ? (
      <HintLine hint={hint} label={t.game.hint} blankLabel={t.game.hiddenWord} uiLang={lang} className="text-center" />
    ) : null;

  return (
    <section aria-labelledby={headingId} className="mx-auto max-w-2xl space-y-8 sm:space-y-10">
      {/* Always mounted, so screen readers announce each verdict when its text changes. */}
      <p id={liveId} className="sr-only" aria-live="polite">
        {verdict ? (verdict.correct ? t.game.correct : `${t.game.wrong}: ${item.answer}`) : ""}
      </p>

      <GameTopBar
        exitHref={exitHref}
        onExit={onExit}
        exitLabel={t.game.quit}
        progress={timed ? undefined : progress}
        progressLabel={itemLine}
        status={
          timed ? (
            <div className="flex items-center justify-center gap-2 text-sm">
              <span className="rounded-full border border-line px-3 py-1 tabular" aria-label={t.game.score}>
                {num(game.points)}
              </span>
              {left !== null && (
                <span
                  className={`rounded-full border px-3 py-1 font-medium tabular ${left < 10_000 ? "border-error/60 text-error" : "border-line"}`}
                  aria-label={t.game.timeLeft}
                  role="timer"
                >
                  {num(Math.ceil(left / 1000))}
                  {t.common.seconds}
                </span>
              )}
            </div>
          ) : undefined
        }
        chip={
          <div className="flex shrink-0 items-center gap-2">
            {!timed && (
              <span className={`${chipVariants({ tone: "neutral", size: "sm" })} tabular`} aria-label={t.game.score}>
                {num(game.points)}
              </span>
            )}
            {game.combo >= 3 && (
              <span className={chipVariants({ tone: "neutral", size: "sm" })} aria-label={t.game.comboLabel(mult)}>
                {t.game.combo(mult)}
              </span>
            )}
            {level && (
              <span className={`${chipVariants({ tone: "level-active", size: "sm" })} font-latin tabular`} title={t.levels.inGame}>
                <span className="sr-only">{t.levels.inGame}: </span>
                {level}
              </span>
            )}
          </div>
        }
      />

      <GameHeading id={headingId} title={title} meta={[meta, timed ? null : itemLine].filter(Boolean).join(" / ")} />

      {notStarted ? (
        <div className="space-y-6 py-4 text-center">
          <p className="text-fg-2">{t.modes[item.mode]?.desc}</p>
          <Button
            variant="primary"
            size="lg"
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
          <div ref={areaRef} className="space-y-6">
            {listenLike && !answered && (
              <div className="flex flex-col items-center gap-5">
                {canSpeak ? (
                  <>
                    <AudioButton
                      label={t.game.listen}
                      onPlay={() => item.speak && speak(item.speak)}
                      onMouseDown={keepInputFocus}
                      ringing={!typingStarted && !answered}
                    />
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button variant="outline" size="sm" onMouseDown={keepInputFocus} onClick={() => speak(item.answer, 0.6)}>
                        <Turtle className="size-4" strokeWidth={1.5} aria-hidden="true" />
                        {t.game.slow}
                      </Button>
                      {item.kind !== "sentence" && word.example && (
                        <Button variant="outline" size="sm" onMouseDown={keepInputFocus} onClick={() => speak(word.example ?? "")}>
                          {t.game.example}
                        </Button>
                      )}
                    </div>
                  </>
                ) : voice === "checking" ? (
                  <p className="text-sm text-fg-2">{t.common.loading}</p>
                ) : (
                  <div className="w-full space-y-3">
                    <p role="note" className="rounded-2xl border border-line bg-surface p-4 text-sm text-fg-2">
                      {t.game.noVoice}
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setRevealed(true);
                        setRevealing(true);
                      }}
                      disabled={revealing || answered}
                    >
                      <Eye className="size-4" aria-hidden="true" />
                      {t.game.showWord}
                    </Button>
                  </div>
                )}
                {canSpeak && usingOtherAccent && <p className="text-center text-sm text-fg-2">{t.game.otherAccent}</p>}
              </div>
            )}

            <Prompt
              item={item}
              word={word}
              fixPick={fixPick}
              answered={answered}
              onPickToken={(i) => {
                if (fixPick === null) setFixPick(i);
              }}
              labels={{
                fix: t.game.fixPrompt,
                fixWrong: t.game.fixWrongPick,
                missing: t.game.missingPrompt,
                scramble: t.game.scramblePrompt,
                choice: t.game.choicePrompt,
                sentence: t.game.sentencePrompt,
                meaning: t.game.meaning,
                blank: t.game.hiddenWord,
                uiLang: lang,
              }}
              revealing={revealing}
              title={title}
            />

            {item.kind === "choice" && (
              <ChoiceOptions item={item} answered={answered} picked={verdict?.answer ?? null} onPick={(o) => submit(o)} hint={t.game.choiceKeys} />
            )}

            {showBoxes && <LetterBoxes value={input.state.value} />}
            {meaningLine}
          </div>

          {showInput && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onEnter();
              }}
              className="space-y-2"
            >
              <label htmlFor={inputId} className="block text-sm font-medium text-fg-2">
                {item.kind === "fix" ? t.game.fixType : item.kind === "sentence" ? t.game.typeSentence : t.game.typeHere}
              </label>
              <SpellingInput
                ref={inputRef}
                id={inputId}
                state={input.state}
                dispatch={onInputEvent}
                onEnter={onEnter}
                label={item.kind === "fix" ? t.game.fixType : item.kind === "sentence" ? t.game.typeSentence : t.game.typeHere}
                tone={tone}
                describedBy={liveId}
                size={item.kind === "sentence" ? "md" : "lg"}
                // The input is mounted again only when switching between item kinds (mixed rounds).
                autoFocus
              />
            </form>
          )}

          {verdict && (
            <Feedback
              verdict={verdict}
              item={item}
              word={word}
              info={info}
              lang={lang}
              onListen={canSpeak ? () => speak(item.answer, 0.85) : null}
            />
          )}

          {(answered || showInput) && (
            <div className="flex flex-wrap items-center gap-3 max-sm:sticky max-sm:bottom-[var(--keyboard-inset,0px)] max-sm:z-10 max-sm:-mx-4 max-sm:border-t max-sm:border-line max-sm:bg-canvas max-sm:px-4 max-sm:py-3">
              {answered ? (
                <Button
                  variant="primary"
                  ref={nextRef}
                  size="lg"
                  onMouseDown={showInput ? keepInputFocus : undefined}
                  onPointerDown={(e) => {
                    nextPressRef.current = { itemKey: item.key, x: e.clientX, y: e.clientY, t: e.timeStamp };
                  }}
                  onClick={(e) => {
                    // Keyboard and plain clicks; a press the window listener already handled is skipped.
                    if (handledClickRef.current === e.nativeEvent) return;
                    goNext();
                  }}
                  className="flex-1 sm:flex-none sm:min-w-48"
                >
                  {game.index + 1 >= game.items.length ? t.game.finish : t.game.next}
                </Button>
              ) : (
                showInput && (
                  <>
                    <Button
                      variant="primary"
                      size="lg"
                      onMouseDown={keepInputFocus}
                      onClick={onEnter}
                      disabled={input.state.value.trim() === ""}
                      className="flex-1 sm:flex-none sm:min-w-48"
                    >
                      {t.game.check}
                    </Button>
                    <Button variant="quiet" size="lg" onMouseDown={keepInputFocus} onClick={() => submit("", { forcedWrong: true })}>
                      {t.game.dontKnow}
                    </Button>
                  </>
                )
              )}
              {answered && showInput && <p className="text-sm text-fg-3 max-sm:hidden">{t.game.pressEnter}</p>}
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
  revealing,
  title,
}: {
  item: GameItem;
  word: PlayWord;
  fixPick: number | null;
  answered: boolean;
  onPickToken: (i: number) => void;
  labels: Record<"fix" | "fixWrong" | "missing" | "scramble" | "choice" | "sentence" | "meaning" | "blank", string> & { uiLang: "ar" | "en" };
  revealing: boolean;
  /** The screen title; a prompt that only repeats it is left out. */
  title: string;
}) {
  // Games only play words with a hint (DECISIONS M4); a word without one shows no line.
  const hint = hintFor(word);
  // A choice item that already shows the blanked sentence (homophones) does not repeat it as the hint.
  const repeatsContext = item.kind === "choice" && Boolean(item.context) && hint?.kind === "sentence";
  const meaning = hint && !repeatsContext ? <HintLine hint={hint} label={labels.meaning} blankLabel={labels.blank} uiLang={labels.uiLang} /> : null;
  if (revealing) {
    return (
      <p dir="ltr" lang="en" aria-live="polite" className="text-center font-word text-[clamp(2rem,9vw,3.25rem)] break-words">
        {item.answer}
      </p>
    );
  }
  switch (item.kind) {
    case "fix":
      return (
        <div className="space-y-4">
          <p className="text-fg-2">{labels.fix}</p>
          <p dir="ltr" lang="en" className="flex flex-wrap gap-x-1 gap-y-2 text-[clamp(1.25rem,4.5vw,1.6rem)] leading-relaxed">
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
                  className={`min-h-11 rounded-xl px-1.5 transition-colors ${
                    reveal
                      ? "text-error underline decoration-error decoration-wavy underline-offset-4"
                      : picked
                        ? "bg-raised line-through decoration-fg-3"
                        : "hover:bg-raised"
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
        <div className="space-y-2 text-center">
          {labels.choice !== title && <p className="text-fg-2">{labels.choice}</p>}
          {item.context && (
            <p dir="ltr" lang="en" className="text-xl">
              {item.context}
            </p>
          )}
          {meaning}
        </div>
      );
    case "sentence":
      return <p className="text-center text-fg-2">{labels.sentence}</p>;
    case "typed":
      if (item.masked) {
        return (
          <div className="space-y-3 text-center">
            <p className="text-fg-2">{labels.missing}</p>
            <p
              dir="ltr"
              lang="en"
              className="font-word text-[clamp(2rem,9vw,3.25rem)] tracking-[0.2em] break-all"
              aria-label={item.masked.replace(/_/g, " blank ")}
            >
              {[...item.masked].map((ch, i) => (ch === "_" ? <span key={i} className="text-gold">_</span> : <span key={i}>{ch}</span>))}
            </p>
            {meaning}
          </div>
        );
      }
      if (item.letters) {
        return (
          <div className="space-y-4 text-center">
            <p className="text-fg-2">{labels.scramble}</p>
            <ul dir="ltr" lang="en" className="flex flex-wrap justify-center gap-2" aria-label={item.letters.join(" ")}>
              {item.letters.map((l, i) => (
                <li key={i} className="grid size-12 place-items-center rounded-xl border border-line-strong bg-surface font-word text-2xl uppercase">
                  {l}
                </li>
              ))}
            </ul>
            {meaning}
          </div>
        );
      }
      return null;
  }
}

function ChoiceOptions({
  item,
  answered,
  picked,
  onPick,
  hint,
}: {
  item: GameItem;
  answered: boolean;
  picked: string | null;
  onPick: (o: string) => void;
  hint: string;
}) {
  return (
    <div className="space-y-3">
      <ul className="grid gap-3 sm:grid-cols-2" dir="ltr" lang="en">
        {(item.options ?? []).map((o, i) => {
          const state = !answered ? "idle" : o === item.answer ? "right" : o === picked ? "wrong" : "dim";
          return (
            <li key={o}>
              <button
                type="button"
                onClick={() => onPick(o)}
                disabled={answered}
                className={`flex min-h-16 w-full items-center gap-3 rounded-2xl border px-4 text-start font-word text-[clamp(1.25rem,4.5vw,1.5rem)] transition-colors ${
                  state === "right"
                    ? "border-fg bg-raised text-fg"
                    : state === "wrong"
                      ? "border-error border-dashed text-error line-through"
                      : state === "dim"
                        ? "border-line text-fg-3"
                        : "border-line-strong bg-surface hover:border-fg-2 hover:bg-raised"
                }`}
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line font-sans text-sm text-fg-2 no-underline">{i + 1}</span>
                <span className="min-w-0 break-words">{o}</span>
                {state === "right" && <Check className="ms-auto size-5 shrink-0" aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ul>
      {!answered && <p className="text-center text-sm text-fg-3 max-sm:hidden">{hint}</p>}
    </div>
  );
}

function Feedback({
  verdict,
  item,
  word,
  info,
  lang,
  onListen,
}: {
  verdict: Verdict;
  item: GameItem;
  word: PlayWord;
  info: CategoryInfo;
  lang: "ar" | "en";
  onListen: (() => void) | null;
}) {
  const { t } = useI18n();
  const v = verdict.check?.verdict;
  const review = verdict.nextReviewDays !== null ? t.review.nextReview(verdict.nextReviewDays) : null;

  if (verdict.correct) {
    return (
      <div className="space-y-2">
        <CorrectLine text={v === "other-variant" ? t.game.otherVariant(item.answer) : t.game.correct} />
        {item.kind !== "sentence" && (
          // Rendered from the start (hidden until the note arrives), so Next does not move (DECISIONS M2).
          <p className={`min-h-5 text-sm text-fg-2 ${review ? "" : "invisible"}`}>{review}</p>
        )}
        {word.exampleCredit && (item.kind === "sentence" || word.example) && <TatoebaCreditLine credit={word.exampleCredit} />}
        {/* The fallback hint showed the example's Arabic translation: credit its own author (CC BY). */}
        {!word.ar && word.exampleAr && item.kind !== "sentence" && <TatoebaCreditLine credit={word.exampleAr.credit} />}
      </div>
    );
  }

  const diff = verdict.check?.diff ?? null;
  const wrote = verdict.answer.trim() !== "" && item.kind !== "choice" && diff && diff.length > 0;
  return (
    <div className="space-y-6">
      {wrote && (
        <div className="space-y-1">
          <p className="text-sm text-fg-2">{t.game.youWrote}</p>
          <AnswerMarks segments={diff} labels={t.game.marks} />
        </div>
      )}
      {item.kind === "sentence" ? (
        <div className="space-y-2">
          <p className="text-sm text-fg-2">{t.game.wrong}</p>
          <p dir="ltr" lang="en" className="font-word text-xl leading-relaxed sm:text-2xl">
            {item.answer}
          </p>
          {word.exampleCredit && <TatoebaCreditLine credit={word.exampleCredit} />}
        </div>
      ) : (
        <>
          <CorrectionHeader
            label={t.game.wrong}
            segments={verdict.answer.trim() === "" ? null : diff}
            word={item.answer}
            keyLabel={t.game.keyLetter}
            listenLabel={t.game.listenCorrect}
            onListen={onListen}
            onMouseDown={keepInputFocus}
          />
          <RuleCard
            label={t.game.rule}
            title={info.label[lang]}
            rule={info.rule[lang]}
            trickLabel={t.game.trick}
            trick={trickFor(info, item.answer, lang)}
            exampleLabel={t.game.exampleLabel}
            example={word.example}
            footer={
              <>
                {word.example && word.exampleCredit && <TatoebaCreditLine credit={word.exampleCredit} tone="text-on-mint-2" />}
                {!word.ar && word.exampleAr && <TatoebaCreditLine credit={word.exampleAr.credit} tone="text-on-mint-2" />}
                {/* Rendered from the start (hidden until the note arrives), so Next does not move (DECISIONS M2). */}
                <p className={`min-h-[calc(2lh+0.75rem)] border-t border-on-mint/15 pt-3 text-sm text-on-mint-2 ${review ? "" : "invisible"}`}>
                  <span className="font-medium text-on-mint">{t.game.addedToReview}</span> {review ?? t.common.loading}
                </p>
              </>
            }
          />
        </>
      )}
    </div>
  );
}
