"use client";

import { useCallback, useState } from "react";
import type { TestSource } from "@/domain/typing/personal-best";
import type { SaveTestOutcome } from "@/repositories/types";
import { TypingRun } from "./typing-run";
import { ResultsPanel } from "./results-panel";
import { useSaveTypingResult } from "./use-save-result";
import type { FinishedSession } from "./use-typing-session";

/**
 * Untimed run over a fixed text (lessons, drills, custom text). The result is
 * saved with duration 0 so it never competes with timed personal bests.
 */
export function UntimedPractice({
  text,
  source,
  modeLabel,
  onAgain,
  onComplete,
}: {
  text: string;
  source: TestSource;
  modeLabel: string;
  onAgain: () => void;
  onComplete?: (session: FinishedSession) => void;
}) {
  const save = useSaveTypingResult();
  const [finished, setFinished] = useState<FinishedSession | null>(null);
  const [outcome, setOutcome] = useState<SaveTestOutcome | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  const onFinish = useCallback(
    (s: FinishedSession) => {
      setFinished(s);
      onComplete?.(s);
      save(s, source, 0)
        .then(setOutcome)
        .catch(() => setSaveFailed(true));
    },
    [save, source, onComplete],
  );

  if (finished) {
    return (
      <ResultsPanel
        session={finished}
        outcome={outcome}
        modeLabel={modeLabel}
        saveFailed={saveFailed}
        onAgain={() => {
          setFinished(null);
          setOutcome(null);
          setSaveFailed(false);
          onAgain();
        }}
      />
    );
  }
  return <TypingRun target={text} durationSec={null} onFinish={onFinish} />;
}
