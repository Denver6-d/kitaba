"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";
import { isStageUnlocked, parseStageId, stageDef } from "@/domain/games/campaign";
import { useI18n } from "@/i18n";
import { useRepoQuery } from "@/repositories/provider";
import { EmptyBlock, LoadingBlock } from "@/components/page";
import { Button } from "@/components/ui/button";
import { GameRunner } from "@/features/games/game-runner";
import { parseGameRequest } from "@/features/games/parse-request";

export function GameView() {
  const { t, lang } = useI18n();
  const params = useSearchParams();
  const request = parseGameRequest(params);
  const stages = useRepoQuery((r) => r.games.stages());

  let title: string;
  let meta: string | null = null;
  if (request.kind === "stage") {
    const def = stageDef(request.id);
    const p = parseStageId(request.id);
    title = def ? def.world.name[lang] : t.play.title;
    if (def && p) meta = `${t.play.world(p.world)} / ${def.boss ? t.play.boss : t.play.stage(p.stage)}`;
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
  } else body = <GameRunner key={JSON.stringify(request)} request={request} title={title} meta={meta} />;

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
      <h1 className="sr-only">{title}</h1>
      {body}
    </div>
  );
}
