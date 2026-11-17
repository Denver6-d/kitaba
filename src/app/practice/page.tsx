"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useClientSeed, useHydrated } from "@/lib/use-hydrated";
import { seededRng } from "@/domain/shared/random";
import { hintLevel, nextMastery } from "@/domain/progress/hints";
import { modeKey, TEST_DURATIONS, type TestDuration } from "@/domain/typing/personal-best";
import type { TestText } from "@/domain/typing/text";
import { useI18n } from "@/i18n";
import { useRepoQuery, useRepos } from "@/repositories/provider";
import type { SaveTestOutcome, SubmitStatus } from "@/repositories/types";
import { Page, LoadingBlock } from "@/components/page";
import { Segmented } from "@/components/segmented";
import { TypingRun } from "@/features/typing/typing-run";
import { ResultsPanel } from "@/features/typing/results-panel";
import { textForTest, typingMeaning } from "@/features/typing/content";
import { useSaveTypingResult } from "@/features/typing/use-save-result";
import type { FinishedSession } from "@/features/typing/use-typing-session";

type Source = "sentences" | "words";

export default function PracticePage() {
  const { t, num } = useI18n();
  const repos = useRepos();
  const save = useSaveTypingResult();
  const [duration, setDuration] = useState<TestDuration>(30);
  const [source, setSource] = useState<Source>("sentences");
  const [nonce, setNonce] = useState(0);
  const [finished, setFinished] = useState<FinishedSession | null>(null);
  const [outcome, setOutcome] = useState<SaveTestOutcome | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [leaderboard, setLeaderboard] = useState<SubmitStatus | null>(null);
  // A late leaderboard answer must not land on the next test.
  const testRef = useRef(0);

  const key = modeKey(source, duration);
  const profile = useRepoQuery((r) => r.profile.get());
  const ghost = useRepoQuery((r) => r.progress.ghost(key), [key]);
  const mastery = useRepoQuery((r) => r.sentences.allMastery());
  const level = profile.status === "ready" ? profile.data.level : null;

  const hydrated = useHydrated();
  const seed = useClientSeed();
  // Random text is generated on the client only (avoids a hydration mismatch), once the level is known.
  const text = useMemo<TestText | null>(
    () => (hydrated && profile.status !== "loading" ? textForTest(source, duration, seededRng(seed + nonce), level) : null),
    [hydrated, profile.status, source, duration, seed, nonce, level],
  );

  const newTest = useCallback(() => {
    setFinished(null);
    setOutcome(null);
    setSaveFailed(false);
    setLeaderboard(null);
    testRef.current += 1;
    setNonce((n) => n + 1);
  }, []);

  const onFinish = useCallback(
    (session: FinishedSession) => {
      setFinished(session);
      (async () => {
        const test = testRef.current;
        const result = await save(session, source, duration);
        setOutcome(result);
        void result.leaderboard.then((s) => {
          if (testRef.current === test) setLeaderboard(s);
        });
        // Sentences typed without a mistake count toward fading their Arabic hint.
        if (text) {
          for (const seg of text.segments) {
            if (seg.end > session.state.typed.length) break;
            const ok = session.state.typed.slice(seg.start, seg.end) === session.state.target.slice(seg.start, seg.end);
            const k = `typing:${seg.id}`;
            const current = mastery.status === "ready" ? (mastery.data[k] ?? 0) : 0;
            await repos.sentences.setMastery(k, nextMastery(current, ok));
          }
        }
      })().catch(() => setSaveFailed(true));
    },
    [save, source, duration, text, mastery, repos],
  );

  const meaningFor = (id: string) => {
    if (source !== "sentences") return null;
    const m = mastery.status === "ready" ? (mastery.data[`typing:${id}`] ?? 0) : 0;
    return hintLevel(m) === "none" ? null : typingMeaning(id);
  };

  return (
    <Page title={t.test.title}>
      {finished ? (
        <ResultsPanel
          session={finished}
          outcome={outcome}
          leaderboard={leaderboard}
          onAgain={newTest}
          saveFailed={saveFailed}
          modeLabel={`${t.test.sources[source]} · ${num(duration)} ${t.common.seconds}`}
        />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-4">
            <Segmented
              legend={t.test.source}
              value={source}
              onChange={(v) => {
                setSource(v);
                setNonce((n) => n + 1);
              }}
              options={[
                { value: "sentences", label: t.test.sources.sentences },
                { value: "words", label: t.test.sources.words },
              ]}
            />
            <Segmented
              legend={t.test.duration}
              value={duration}
              onChange={(v) => {
                setDuration(v);
                setNonce((n) => n + 1);
              }}
              options={TEST_DURATIONS.map((d) => ({ value: d, label: `${num(d)} ${t.common.seconds}` }))}
            />
          </div>
          {text ? (
            <TypingRun
              key={`${key}-${nonce}-${level ?? ""}`}
              target={text.text}
              segments={text.segments}
              meaningFor={meaningFor}
              durationSec={duration}
              onFinish={onFinish}
              onRestart={() => setNonce((n) => n + 1)}
              ghost={ghost.status === "ready" ? (ghost.data?.ghost ?? null) : null}
            />
          ) : (
            <LoadingBlock label={t.common.loading} />
          )}
        </div>
      )}
    </Page>
  );
}
