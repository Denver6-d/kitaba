"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play, RotateCcw, Volume2 } from "lucide-react";
import { dictationMessages, dictationSentences } from "@/data/writing";
import { TatoebaCreditLine } from "@/features/library/credit-line";
import { getLibrary, LIBRARY_WAIT_MS, withTimeout } from "@/features/library/library";
import type { CefrLevel } from "@/domain/model";
import { compareDictation, type DictationResult, type DictationSegment } from "@/domain/writing/dictation";
import { summarizeWriting, type WritingSummary } from "@/domain/writing/summary";
import { useI18n } from "@/i18n";
import { useSettings } from "@/lib/settings-store";
import { useSpeech } from "@/lib/speech";
import { useRepoContext } from "@/repositories/provider";
import { ErrorBlock, LoadingBlock } from "@/components/page";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { dictationPool, type DictItem } from "./dictation-pool";
import { drawNext } from "./draw";
import { MistakeDetail } from "./mistake-detail";
import { useSaveWriting, type SavedWriting } from "./use-save-writing";
import { WritingSummaryPanel } from "./writing-summary";
import { WritingTextarea } from "./writing-textarea";

type Kind = "sentence" | "message";
type Speed = "normal" | "slow";
const RATE: Record<Speed, number> = { normal: 0.9, slow: 0.65 };

interface Result {
  readonly typed: string;
  readonly diff: DictationResult;
  readonly summary: WritingSummary;
  readonly saved: SavedWriting | null;
  readonly saveFailed: boolean;
}

/**
 * Dictation of whole sentences and longer messages (SPEC 6.7). Speech is
 * on-device only (DECISIONS D11). Messages are read one sentence at a time,
 * with replay, a slower speed and "listen to the whole message".
 */
export function Dictation({ level }: { level: CefrLevel }) {
  const { t, lang } = useI18n();
  const [settings] = useSettings();
  const { status, speak, usingOtherAccent } = useSpeech();
  const { outbox } = useRepoContext();
  const save = useSaveWriting();
  const areaId = useId();
  const [kind, setKind] = useState<Kind>("sentence");
  const [round, setRound] = useState(0);
  /** The drawn text, tagged with what it was drawn for: a stale one (kind, level or round changed) shows as loading. */
  const [drawn, setDrawn] = useState<{ readonly key: string; readonly item: DictItem | null } | null>(null);
  const drawKey = `${kind}:${level}:${round}`;
  const item = drawn && drawn.key === drawKey ? drawn.item : undefined;
  const [index, setIndex] = useState(0);
  const [speed, setSpeed] = useState<Speed>("normal");
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  /** Without an on-device voice, the learner can look at the current sentence, then hide it and type it. */
  const [peek, setPeek] = useState(false);
  const startedAt = useRef(0);
  const resultRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let alive = true;
    // Sentences also come from the open-data library at this level (loaded on demand; none when offline and not stored).
    const library = kind === "sentence" ? withTimeout(getLibrary().sentencesAt(level), LIBRARY_WAIT_MS, []) : Promise.resolve([]);
    void library
      .then((lib) => {
        const pool = dictationPool(kind === "sentence" ? dictationSentences : dictationMessages, lib, level, kind);
        return drawNext(outbox, `write:dict:${kind}:${level}`, [...pool.keys()]).then((id) => (id ? (pool.get(id) ?? null) : null));
      })
      .then((next) => {
        if (!alive) return;
        setDrawn({ key: `${kind}:${level}:${round}`, item: next });
        setIndex(0);
        setTyped("");
        setResult(null);
        setSelected(null);
        setPeek(false);
        startedAt.current = Date.now();
      });
    return () => {
      alive = false;
    };
  }, [outbox, level, kind, round]);

  useEffect(() => {
    if (result) resultRef.current?.focus();
  }, [result]);

  if (item === undefined) return <LoadingBlock label={t.common.loading} />;
  if (item === null) return <ErrorBlock title={t.common.errorTitle} body={t.common.errorBody} />;

  const sentences = item.sentences;
  const full = sentences.join(" ");
  const canSpeak = status === "ready";
  const sayCurrent = () => speak(sentences[index] ?? "", RATE[speed]);

  const onCheck = () => {
    const diff = compareDictation(full, typed);
    const wrong = diff.segments.flatMap((s) => (s.kind === "wrong" ? [{ wrong: s.typed, right: s.word, type: s.type }] : []));
    const extra = diff.segments.filter((s) => s.kind === "extra").length;
    const summary = summarizeWriting(diff.words + extra, wrong, diff.mistakes);
    setResult({ typed, diff, summary, saved: null, saveFailed: false });
    const seconds = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
    save({ mode: "dictation", sourceId: item.id, level, text: typed, reference: full, summary, seconds })
      .then((saved) => setResult((r) => (r ? { ...r, saved } : r)))
      .catch(() => setResult((r) => (r ? { ...r, saveFailed: true } : r)));
  };

  const header = (
    <div className="flex flex-wrap items-end gap-6">
      <Segmented
        legend={t.writing.dictKind}
        value={kind}
        onChange={(k) => setKind(k)}
        options={(["sentence", "message"] as const).map((k) => ({ value: k, label: t.writing.dictKinds[k] ?? k }))}
      />
      <Segmented legend={t.writing.speed} value={speed} onChange={setSpeed} options={(["normal", "slow"] as const).map((s) => ({ value: s, label: t.writing.speeds[s] ?? s }))} />
      <span className="rounded-full border border-brass-fill/60 px-2.5 py-0.5 text-sm text-brass tabular" title={t.levels.inGame}>
        <span className="sr-only">{t.levels.inGame}: </span>
        {level}
      </span>
    </div>
  );

  if (result) {
    const segs = result.diff.segments;
    const current = selected === null ? undefined : segs[selected];
    return (
      <div className="space-y-6">
        <section className="sheet space-y-4 p-5 sm:p-6" aria-labelledby="d-res">
          <h2 id="d-res" ref={resultRef} tabIndex={-1} className="text-lg font-semibold outline-none">
            {result.diff.mistakes === 0 ? t.writing.noMistakes : `${t.writing.mistakesFound(result.diff.mistakes)} · ${t.writing.tapHint}`}
          </h2>
          <DiffView segments={segs} selected={selected} onSelect={setSelected} labels={{ missing: t.writing.missingWord, extra: t.writing.extraWord }} />
          {current?.kind === "wrong" && (
            <MistakeDetail
              key={selected}
              accent={settings.accent}
              m={{ word: current.typed, suggestion: current.word, type: current.type, kind: "spelling", context: sentences.find((s) => s.includes(current.word)) }}
            />
          )}
          <details className="text-ink-soft">
            <summary className="min-h-11 cursor-pointer py-2">{t.writing.original}</summary>
            <p dir="ltr" lang="en" className="font-mono">
              {full}
            </p>
            {item.credit && <TatoebaCreditLine credit={item.credit} className="mt-1" />}
          </details>
          {item.ar && (
            <div className="space-y-1">
              <p className="text-hint">
                <span className="font-semibold">{t.writing.translation}:</span> <span lang="ar" dir="rtl">{item.ar.text}</span>
              </p>
              <TatoebaCreditLine credit={item.ar.credit} />
            </div>
          )}
        </section>
        <WritingSummaryPanel summary={result.summary} saved={result.saved} saveFailed={result.saveFailed} />
        <div className="flex flex-wrap gap-3">
          <Button size="lg" className="h-12 flex-1 px-6 text-base sm:flex-none" onClick={() => setRound((r) => r + 1)}>
            {t.common.next}
          </Button>
          <Button asChild size="lg" variant="ghost" className="h-12">
            <Link href="/write">{t.common.back}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const Prev = lang === "ar" ? ChevronRight : ChevronLeft;
  const Next = lang === "ar" ? ChevronLeft : ChevronRight;
  return (
    <div className="space-y-6">
      {header}
      <section className="sheet space-y-4 p-5 sm:p-6" aria-labelledby="d-task">
        <h2 id="d-task" className="text-lg font-semibold">
          {item.title ? `${t.writing.dictKinds.message}: ${item.title[lang]}` : t.writing.typeWhat}
        </h2>
        {!canSpeak && status !== "checking" ? (
          <div className="space-y-3">
            <p className="rounded-lg bg-[var(--error-wash)] p-3 text-sm">{t.writing.noVoice}</p>
            {sentences.length > 1 && <p className="text-sm text-ink-soft tabular">{t.writing.sentenceOf(index + 1, sentences.length)}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" className="h-11" aria-expanded={peek} onClick={() => setPeek((p) => !p)}>
                {peek ? t.writing.hideText : t.writing.showText}
              </Button>
              {sentences.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11"
                  disabled={index >= sentences.length - 1}
                  onClick={() => {
                    setIndex((i) => Math.min(sentences.length - 1, i + 1));
                    setPeek(false);
                  }}
                >
                  {t.writing.nextSentence}
                </Button>
              )}
            </div>
            {peek && (
              <>
                <p dir="ltr" lang="en" className="font-mono text-lg">
                  {sentences[index]}
                </p>
                {item.credit && <TatoebaCreditLine credit={item.credit} />}
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {sentences.length > 1 && <p className="text-sm text-ink-soft tabular">{t.writing.sentenceOf(index + 1, sentences.length)}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="lg" className="h-12 gap-2 px-6" disabled={!canSpeak} onClick={sayCurrent}>
                <Volume2 className="size-5" aria-hidden="true" />
                {t.writing.play}
              </Button>
              {sentences.length > 1 && (
                <>
                  <Button type="button" variant="outline" className="h-11" disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))} aria-label={t.writing.prevSentence}>
                    <Prev className="size-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 gap-1"
                    disabled={index >= sentences.length - 1}
                    onClick={() => {
                      const n = Math.min(sentences.length - 1, index + 1);
                      setIndex(n);
                      speak(sentences[n] ?? "", RATE[speed]);
                    }}
                  >
                    {t.writing.nextSentence}
                    <Next className="size-4" aria-hidden="true" />
                  </Button>
                  <Button type="button" variant="ghost" className="h-11 gap-2" disabled={!canSpeak} onClick={() => speak(full, RATE[speed])}>
                    <Play className="size-4" aria-hidden="true" />
                    {t.writing.playAll}
                  </Button>
                </>
              )}
              {sentences.length === 1 && (
                <Button type="button" variant="ghost" className="h-11 gap-2" disabled={!canSpeak} onClick={sayCurrent}>
                  <RotateCcw className="size-4" aria-hidden="true" />
                  {t.writing.replay}
                </Button>
              )}
            </div>
            {usingOtherAccent && <p className="text-sm text-ink-soft">{t.game.otherAccent}</p>}
          </div>
        )}
      </section>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (typed.trim()) onCheck();
        }}
      >
        <WritingTextarea id={areaId} label={t.writing.typeWhat} value={typed} onChange={(e) => setTyped(e.target.value)} rows={sentences.length > 1 ? 7 : 3} maxLength={4000} />
        <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-rule bg-paper/95 px-4 py-3 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
          <Button type="submit" size="lg" className="h-12 flex-1 px-6 text-base sm:flex-none" disabled={typed.trim() === ""}>
            {t.common.check}
          </Button>
          {canSpeak && (
            <Button type="button" variant="outline" size="lg" className="h-12 gap-2" onClick={sayCurrent} aria-label={t.writing.replay}>
              <Volume2 className="size-5" aria-hidden="true" />
            </Button>
          )}
          <button type="button" className="ms-auto min-h-11 text-sm text-ink-soft underline underline-offset-4" onClick={() => setRound((r) => r + 1)}>
            {t.common.next}
          </button>
        </div>
      </form>
    </div>
  );
}

/** The dictation compared word by word: right words plain, misspelled ones as buttons, missing words inserted, extra words struck. */
function DiffView({
  segments,
  selected,
  onSelect,
  labels,
}: {
  segments: readonly DictationSegment[];
  selected: number | null;
  onSelect: (i: number) => void;
  labels: { missing: string; extra: string };
}) {
  return (
    <p dir="ltr" lang="en" className="ruled rounded-xl border border-rule bg-paper p-4 font-mono text-lg leading-loose sm:text-xl">
      {segments.map((s, i) => {
        const sep = i > 0 ? " " : "";
        switch (s.kind) {
          case "ok":
            return (
              <span key={i}>
                {sep}
                {s.typed}
              </span>
            );
          case "wrong":
            return (
              <span key={i}>
                {sep}
                <button
                  type="button"
                  aria-pressed={selected === i}
                  onClick={() => onSelect(i)}
                  className={`rounded-sm px-0.5 text-error underline decoration-wavy decoration-2 underline-offset-4 ${selected === i ? "bg-brass-wash outline-2 outline-brass-fill" : "hover:bg-brass-wash"}`}
                >
                  {s.typed}
                </button>
              </span>
            );
          case "missing":
            return (
              <span key={i}>
                {sep}
                <ins className="rounded bg-[var(--correct-wash)] px-1 text-correct underline decoration-2 underline-offset-4">
                  <span className="sr-only">({labels.missing}) </span>
                  {s.word}
                </ins>
              </span>
            );
          case "extra":
            return (
              <span key={i}>
                {sep}
                <del className="text-error decoration-2">
                  <span className="sr-only">({labels.extra}) </span>
                  {s.typed}
                </del>
              </span>
            );
        }
      })}
    </p>
  );
}
