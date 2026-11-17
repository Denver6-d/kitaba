"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { scenarioById, scenarios, type Scenario } from "@/data/writing";
import type { CefrLevel } from "@/domain/model";
import { isMistake, type Issue, type TextCheck } from "@/domain/writing/check";
import { summarizeWriting, type WritingSummary } from "@/domain/writing/summary";
import { countWords } from "@/domain/writing/tokenize";
import { useI18n } from "@/i18n";
import { useSettings } from "@/lib/settings-store";
import { useRepoContext } from "@/repositories/provider";
import { ErrorBlock, LoadingBlock } from "@/components/page";
import { Button } from "@/components/ui/button";
import { drawNext } from "./draw";
import { MarkedText } from "./marked-text";
import { MistakeDetail } from "./mistake-detail";
import { checkSpelling, preloadSpeller } from "./spell-client";
import { correctedSentence, useSaveWriting, type SavedWriting } from "./use-save-writing";
import { WritingSummaryPanel } from "./writing-summary";
import { WritingTextarea } from "./writing-textarea";

/** Summary of a check, leaving out words the learner added to their own dictionary. */
function rescore(check: TextCheck, hidden: ReadonlySet<string>): WritingSummary {
  const mistakes = check.issues
    .filter((i) => isMistake(i) && !hidden.has(i.word.toLowerCase()))
    .map((i) => ({ wrong: i.word, right: i.suggestion, type: i.type }));
  return summarizeWriting(check.words, mistakes);
}

type Phase =
  | { readonly kind: "loading" }
  | { readonly kind: "writing" }
  | { readonly kind: "checking" }
  | { readonly kind: "load-error" }
  | {
      readonly kind: "result";
      readonly text: string;
      readonly check: TextCheck;
      readonly summary: WritingSummary;
      readonly saved: SavedWriting | null;
      readonly saveFailed: boolean;
    };

/** Free writing (SPEC 6.7): an Arabic scenario at the learner's sentences level, written in English, spell-checked on the device. */
export function FreeWriting({ level }: { level: CefrLevel }) {
  const { t, lang } = useI18n();
  const [settings] = useSettings();
  const { outbox, repos } = useRepoContext();
  const save = useSaveWriting();
  const textareaId = useId();
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [selected, setSelected] = useState<number | null>(null);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [round, setRound] = useState(0);
  const startedAt = useRef(0);
  /** The last text that was saved and scored: checking it again unchanged earns no XP and no new review miss. */
  const lastSaved = useRef<{ text: string; saved: SavedWriting } | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);

  // Start loading the dictionary in the background while the learner reads the task.
  useEffect(() => {
    preloadSpeller().catch(() => undefined);
  }, []);

  useEffect(() => {
    let alive = true;
    const pool = scenarios.filter((s) => s.level === level).map((s) => s.id);
    void drawNext(outbox, `write:free:${level}`, pool).then((id) => {
      if (!alive) return;
      setScenario(id ? (scenarioById.get(id) ?? null) : null);
      setText("");
      setSelected(null);
      setPhase({ kind: "writing" });
      lastSaved.current = null;
      startedAt.current = Date.now();
    });
    return () => {
      alive = false;
    };
  }, [outbox, level, round]);

  useEffect(() => {
    if (phase.kind === "result") resultRef.current?.focus();
  }, [phase.kind]);

  const words = countWords(text);

  const onCheck = async () => {
    if (!scenario || words === 0) return;
    setPhase({ kind: "checking" });
    setSelected(null);
    setHidden(new Set());
    let check: TextCheck;
    try {
      const personal = await repos.dictionary.words().catch(() => [] as string[]);
      check = await checkSpelling(text, personal, settings.accent);
    } catch {
      setPhase({ kind: "load-error" });
      return;
    }
    const summary = rescore(check, new Set());
    const previous = lastSaved.current;
    if (previous && previous.text === text) {
      setPhase({ kind: "result", text, check, summary, saved: previous.saved, saveFailed: false });
      return;
    }
    setPhase({ kind: "result", text, check, summary, saved: null, saveFailed: false });
    const seconds = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
    const sourceId = scenario.id;
    save({ mode: "free", sourceId, level, text, summary, seconds })
      .then((saved) => {
        lastSaved.current = { text, saved };
        setPhase((p) => (p.kind === "result" && p.text === text ? { ...p, saved } : p));
      })
      .catch(() => setPhase((p) => (p.kind === "result" && p.text === text ? { ...p, saveFailed: true } : p)));
  };

  /**
   * A flagged word the learner adds to their dictionary (a name, a real word) stops counting:
   * the score is recomputed, the saved record amended and the review card it created removed.
   */
  const onAdded = (word: string) => {
    if (phase.kind !== "result") return;
    const lower = word.toLowerCase();
    const nextHidden = new Set([...hidden, lower]);
    setHidden(nextHidden);
    setSelected(null);
    const summary = rescore(phase.check, nextHidden);
    setPhase({ ...phase, summary });
    const saved = phase.saved;
    if (!saved) return;
    const card = saved.newCards[lower];
    if (card) void repos.words.forgetCard(card).catch(() => undefined);
    void repos.writing
      .amend(saved.recordId, {
        mistakes: summary.mistakes,
        accuracy: summary.accuracy,
        stars: summary.stars,
        missed: summary.practice.map((m) => ({ wrong: m.wrong, right: m.right, type: m.type })),
      })
      .catch(() => undefined);
  };

  if (phase.kind === "loading") return <LoadingBlock label={t.common.loading} />;
  if (!scenario) return <ErrorBlock title={t.common.errorTitle} body={t.common.errorBody} />;

  const task = (
    <section aria-labelledby="w-task" className="sheet space-y-3 p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full border border-brass-fill/60 px-2.5 py-0.5 text-brass tabular" title={t.levels.inGame}>
          <span className="sr-only">{t.levels.inGame}: </span>
          {level}
        </span>
        <span className="rounded-full bg-muted px-2.5 py-0.5">{t.writing.kinds[scenario.kind]}</span>
        <span className="text-ink-soft">{t.writing.target(scenario.minWords)}</span>
      </div>
      <h2 id="w-task" className="text-xl font-semibold sm:text-2xl">
        <span className="sr-only">{t.writing.task}: </span>
        {lang === "ar" ? scenario.ar : scenario.en}
      </h2>
      {lang === "ar" && (
        <p dir="ltr" lang="en" className="text-sm text-ink-soft">
          {scenario.en}
        </p>
      )}
      {scenario.words && scenario.words.length > 0 && (
        <p className="text-sm">
          <span className="text-ink-soft">{t.writing.helpWords}: </span>
          <span dir="ltr" lang="en" className="font-mono">
            {scenario.words.join(" · ")}
          </span>
        </p>
      )}
    </section>
  );

  if (phase.kind === "result") {
    const issues = phase.check.issues.filter((i) => !hidden.has(i.word.toLowerCase()));
    const current: Issue | undefined = selected === null ? undefined : issues[selected];
    return (
      <div className="space-y-6">
        {task}
        <section className="space-y-3" aria-labelledby="w-res">
          <h2 id="w-res" ref={resultRef} tabIndex={-1} className="text-lg font-semibold outline-none">
            {issues.filter(isMistake).length === 0 ? t.writing.noMistakes : `${t.writing.mistakesFound(issues.filter(isMistake).length)} · ${t.writing.tapHint}`}
          </h2>
          <MarkedText text={phase.text} issues={issues} selected={selected} onSelect={setSelected} />
          {current && (
            <MistakeDetail
              key={`${current.start}`}
              accent={settings.accent}
              m={{ ...current, context: current.suggestion ? correctedSentence(phase.text, current.word, current.suggestion) : undefined }}
              onAdded={onAdded}
            />
          )}
        </section>
        <WritingSummaryPanel summary={phase.summary} saved={phase.saved} saveFailed={phase.saveFailed} />
        <div className="flex flex-wrap gap-3">
          <Button size="lg" className="h-12 flex-1 px-6 text-base sm:flex-none" onClick={() => setRound((r) => r + 1)}>
            {t.writing.another}
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-12 flex-1 px-6 text-base sm:flex-none"
            onClick={() => {
              setPhase({ kind: "writing" });
              startedAt.current = Date.now();
              window.setTimeout(() => textRef.current?.focus(), 0);
            }}
          >
            {t.writing.editAgain}
          </Button>
          <Button asChild size="lg" variant="ghost" className="h-12">
            <Link href="/write">{t.common.back}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {task}
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void onCheck();
        }}
      >
        <WritingTextarea
          ref={textRef}
          id={textareaId}
          label={t.writing.yourText}
          placeholder={t.writing.placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={4000}
          disabled={phase.kind === "checking"}
        />
        {phase.kind === "load-error" && <p className="rounded-lg bg-[var(--error-wash)] p-3 text-sm text-error">{t.writing.loadError}</p>}
        <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-rule bg-paper/95 px-4 py-3 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
          <Button type="submit" size="lg" className="h-12 flex-1 px-6 text-base sm:flex-none" disabled={words === 0 || phase.kind === "checking"}>
            {phase.kind === "checking" ? t.writing.checking : t.writing.check}
          </Button>
          <span className="text-sm text-ink-soft tabular">{t.writing.wordCount(words)}</span>
          <button
            type="button"
            disabled={phase.kind === "checking"}
            className="ms-auto min-h-11 text-sm text-ink-soft underline underline-offset-4 disabled:opacity-50"
            onClick={() => setRound((r) => r + 1)}
          >
            {t.writing.another}
          </button>
        </div>
        <p className="text-sm text-ink-soft">{t.writing.honest}</p>
      </form>
    </div>
  );
}
