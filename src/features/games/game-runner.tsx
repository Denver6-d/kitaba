"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { spellingWordById } from "@/data/words";
import { nextStageAfter, parseStageId } from "@/domain/games/campaign";
import type { GameState } from "@/domain/games/engine";
import { seededRng } from "@/domain/shared/random";
import { useI18n } from "@/i18n";
import { useSettings } from "@/lib/settings-store";
import { useRepoContext } from "@/repositories/provider";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/page";
import { Button } from "@/components/ui/button";
import { buildSession, type BuiltSession, type GameRequest } from "./build-session";
import { GameSession } from "./game-session";
import { ResultsPanel } from "./results-panel";
import { useFinishGame, type FinishOutcome } from "./use-finish-game";

type Phase =
  | { readonly kind: "loading" }
  | { readonly kind: "error" }
  | { readonly kind: "playing"; readonly session: BuiltSession; readonly round: number }
  | { readonly kind: "done"; readonly session: BuiltSession; readonly outcome: FinishOutcome | null; readonly saveFailed: boolean };

/** Builds a session for a request, plays it, saves it and shows the result. "Again" builds a fresh round. */
export function GameRunner({ request, title, emptyText, emptyAction }: { request: GameRequest; title: string; emptyText?: string; emptyAction?: React.ReactNode }) {
  const { t } = useI18n();
  const { repos, outbox } = useRepoContext();
  const [settings] = useSettings();
  const finish = useFinishGame();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [round, setRound] = useState(0);
  const requestKey = JSON.stringify(request);

  useEffect(() => {
    let alive = true;
    const now = Date.now();
    buildSession(request, { repos, meta: outbox, accent: settings.accent, rng: seededRng(now ^ (round * 7919)), now })
      .then((session) => {
        if (alive) setPhase({ kind: "playing", session, round });
      })
      .catch(() => {
        if (alive) setPhase({ kind: "error" });
      });
    return () => {
      alive = false;
    };
    // Rebuild only for a new request or a new round (not when settings re-render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, round]);

  const onFinish = useCallback(
    (state: GameState) => {
      if (phase.kind !== "playing") return;
      const session = phase.session;
      setPhase({ kind: "done", session, outcome: null, saveFailed: false });
      finish(session, state)
        .then((outcome) => setPhase({ kind: "done", session, outcome, saveFailed: false }))
        .catch(() => setPhase({ kind: "done", session, outcome: null, saveFailed: true }));
    },
    [phase, finish],
  );

  if (phase.kind === "loading") return <LoadingBlock label={t.common.loading} />;
  if (phase.kind === "error") return <ErrorBlock title={t.common.errorTitle} body={t.common.errorBody} onRetry={() => setRound((r) => r + 1)} retryLabel={t.common.retry} />;

  if (phase.kind === "playing") {
    if (phase.session.items.length === 0) {
      return (
        <EmptyBlock
          action={
            emptyAction ?? (
              <Button asChild className="h-11">
                <Link href="/play">{t.nav.play}</Link>
              </Button>
            )
          }
        >
          {emptyText ?? t.game.empty}
        </EmptyBlock>
      );
    }
    return <GameSession key={phase.round} items={phase.session.items} config={phase.session.config} words={spellingWordById} onFinish={onFinish} title={title} />;
  }

  const stageId = phase.session.stageId;
  const next = stageId && parseStageId(stageId) ? nextStageAfter(stageId) : null;
  return (
    <ResultsPanel
      outcome={phase.outcome}
      saveFailed={phase.saveFailed}
      boss={phase.session.boss}
      timed={phase.session.config.durationMs !== null}
      isStage={stageId !== null && parseStageId(stageId) !== null}
      nextHref={next ? `/play/game?stage=${next}` : null}
      onAgain={() => {
        setPhase({ kind: "loading" });
        setRound((r) => r + 1);
      }}
    />
  );
}
