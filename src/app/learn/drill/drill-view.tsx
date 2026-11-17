"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useClientSeed, useHydrated } from "@/lib/use-hydrated";
import { buildDrill } from "@/domain/typing/adaptive";
import { weakestKeys } from "@/domain/typing/key-stats";
import { seededRng } from "@/domain/shared/random";
import { commonWords, typingPhrases } from "@/data/typing";
import { lessons } from "@/data/lessons";
import { useI18n } from "@/i18n";
import { useRepoQuery } from "@/repositories/provider";
import { Page, LoadingBlock } from "@/components/page";
import { Button } from "@/components/ui/button";
import { UntimedPractice } from "@/features/typing/untimed-practice";

/** Phrases first, then lesson drills, then single words. */
const POOL = [...typingPhrases.map((p) => p.text), ...lessons.flatMap((l) => l.drills), ...commonWords.map((w) => (w === "I" ? w : w.toLowerCase()))];
const DRILL_LENGTH = 180;

export function DrillView() {
  const { t } = useI18n();
  const params = useSearchParams();
  const stats = useRepoQuery((r) => r.progress.keyStats());
  const [round, setRound] = useState(0);
  const hydrated = useHydrated();
  const seed = useClientSeed();

  const fromUrl = (params.get("keys") ?? "").toLowerCase().replace(/[^a-z0-9.,;:'"?!-]/g, "").slice(0, 8);
  const keys = fromUrl ? [...new Set(fromUrl)] : stats.status === "ready" ? weakestKeys(stats.data, 4) : [];
  const keysLabel = keys.join(" ");

  const ready = hydrated && (fromUrl !== "" || stats.status !== "loading");
  // Keys are frozen when the drill starts, so saving results (which updates stats) does not reshuffle it.
  const [frozen, setFrozen] = useState<string | null>(null);
  const text = useMemo(
    () => (frozen === null ? null : buildDrill(frozen.split(" ").filter(Boolean), POOL, DRILL_LENGTH, seededRng(seed + round))),
    [frozen, seed, round],
  );

  return (
    <Page
      title={t.learn.adaptive}
      intro={
        keys.length > 0 ? (
          <>
            {t.learn.adaptiveIntro("")}
            <span dir="ltr" className="ms-1 font-mono font-semibold text-ink">
              {keysLabel}
            </span>
          </>
        ) : (
          t.learn.adaptiveEmpty
        )
      }
    >
      {!ready ? (
        <LoadingBlock label={t.common.loading} />
      ) : text === null ? (
        <Button size="lg" className="h-11 px-6" onClick={() => setFrozen(keysLabel)}>
          {t.learn.startDrill}
        </Button>
      ) : (
        <UntimedPractice key={round} text={text} source="adaptive" modeLabel={t.test.sources.adaptive} onAgain={() => setRound((r) => r + 1)} />
      )}
    </Page>
  );
}
