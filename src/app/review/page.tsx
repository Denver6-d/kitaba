"use client";

import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/i18n";
import { useRepoQuery } from "@/repositories/provider";
import { Page, EmptyBlock, LoadingBlock } from "@/components/page";
import { Button } from "@/components/ui/button";
import { GameRunner } from "@/features/games/game-runner";

/** Spaced repetition of the learner's own mistakes (SM-2). */
export default function ReviewPage() {
  const { t, num } = useI18n();
  const [started, setStarted] = useState(false);
  // The due list is read when the page opens; the session captures its own copy.
  const due = useRepoQuery((r) => r.words.dueCards(Date.now()));
  const all = useRepoQuery((r) => r.words.allCards());

  return (
    <Page title={t.review.title} intro={t.review.intro} width="narrow">
      {started ? (
        <GameRunner request={{ kind: "review" }} title={t.review.title} emptyText={t.review.nothingDue} />
      ) : due.status !== "ready" ? (
        <LoadingBlock label={t.common.loading} />
      ) : due.data.length === 0 ? (
        <EmptyBlock
          action={
            <Button variant="primary" asChild className="h-11">
              <Link href="/play">{t.nav.play}</Link>
            </Button>
          }
        >
          {t.review.nothingDue}
        </EmptyBlock>
      ) : (
        <div className="panel flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <p className="text-xl font-semibold">{t.review.dueCount(due.data.length)}</p>
            {all.status === "ready" && <p className="text-fg-2">{t.review.tracked(all.data.length)}</p>}
          </div>
          <Button variant="primary" size="lg" className="h-12 px-8 text-base" onClick={() => setStarted(true)}>
            {t.review.start} ({num(Math.min(15, due.data.length))})
          </Button>
        </div>
      )}
    </Page>
  );
}
