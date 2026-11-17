"use client";

import Link from "next/link";
import { useState } from "react";
import { spellingWordById } from "@/data/words";
import { useI18n } from "@/i18n";
import { useRepos } from "@/repositories/provider";
import type { SpellingWord } from "@/data/schema";
import { Page, LoadingBlock, EmptyBlock, ErrorBlock } from "@/components/page";
import { Button } from "@/components/ui/button";
import { SpellingSession } from "@/features/spelling/spelling-session";
import { useEffectOnce } from "@/lib/use-effect-once";

/** "Due today": every card whose due time has passed, oldest first. */
export default function SpellingReviewPage() {
  const { t } = useI18n();
  const repos = useRepos();
  // The due list is captured once, so reviewing a card does not reshuffle the session.
  const [state, setState] = useState<{ status: "loading" } | { status: "error" } | { status: "ready"; words: SpellingWord[] }>({ status: "loading" });

  useEffectOnce(() => {
    repos.words
      .dueCards(Date.now())
      .then((cards) =>
        setState({ status: "ready", words: cards.map((c) => spellingWordById.get(c.wordId)).filter((w): w is SpellingWord => w !== undefined) }),
      )
      .catch(() => setState({ status: "error" }));
  });

  return (
    <Page title={t.spelling.review} width="narrow">
      {state.status === "loading" && <LoadingBlock label={t.common.loading} />}
      {state.status === "error" && <ErrorBlock title={t.common.errorTitle} body={t.common.errorBody} />}
      {state.status === "ready" &&
        (state.words.length === 0 ? (
          <EmptyBlock
            action={
              <Button asChild className="h-10">
                <Link href="/spelling">{t.spelling.newWords}</Link>
              </Button>
            }
          >
            {t.spelling.nothingDue}
          </EmptyBlock>
        ) : (
          <SpellingSession words={state.words} />
        ))}
    </Page>
  );
}
