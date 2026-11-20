"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { isStageUnlocked, parseStageId, stageDef } from "@/domain/games/campaign";
import { useI18n } from "@/i18n";
import { useRepoQuery } from "@/repositories/provider";
import { EmptyBlock, LoadingBlock } from "@/components/page";
import { Button } from "@/components/ui/button";
import { GameRunner } from "@/features/games/game-runner";
import { parseGameRequest } from "@/features/games/parse-request";

export function GameView() {
  const { t, lang, dir } = useI18n();
  const params = useSearchParams();
  const request = parseGameRequest(params);
  const stages = useRepoQuery((r) => r.games.stages());
  const Back = dir === "rtl" ? ChevronRight : ChevronLeft;

  let title: string;
  if (request.kind === "stage") {
    const def = stageDef(request.id);
    const p = parseStageId(request.id);
    title = def && p ? `${def.world.name[lang]} · ${def.boss ? t.play.boss : t.play.stage(p.stage)}` : t.play.title;
  } else if (request.kind === "daily") title = t.play.daily;
  else if (request.kind === "review") title = t.review.title;
  else title = t.modes[request.mode]?.name ?? t.play.freePlay;

  let body: React.ReactNode;
  // Only the first load can block: a later re-query (sync, sign-in) must never unmount a running game.
  if (request.kind === "stage" && stages.status === "loading") body = <LoadingBlock label={t.common.loading} />;
  else if (request.kind === "stage" && stages.status === "ready" && !isStageUnlocked(request.id, stages.data)) {
    body = (
      <EmptyBlock
        action={
          <Button variant="primary" asChild className="h-11">
            <Link href="/play">{t.game.backToMap}</Link>
          </Button>
        }
      >
        <Lock className="mx-auto mb-2 size-6 text-fg-2" aria-hidden="true" />
        {t.play.lockedHint}
      </EmptyBlock>
    );
  } else body = <GameRunner key={JSON.stringify(request)} request={request} title={title} />;

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 pb-10 sm:px-6 sm:pt-10">
      <Link href="/play" className="mb-4 inline-flex min-h-11 items-center gap-1 rounded-md text-fg-2 hover:text-fg">
        <Back className="size-4" aria-hidden="true" />
        {t.game.backToMap}
      </Link>
      <h1 className="sr-only">{title}</h1>
      {body}
    </div>
  );
}
