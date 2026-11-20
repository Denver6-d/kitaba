"use client";

import Link from "next/link";
import { Headphones, PenLine } from "lucide-react";
import { useI18n } from "@/i18n";
import { Page, LoadingBlock } from "@/components/page";
import { LevelsCard } from "@/features/levels/levels-card";
import { useLevels } from "@/features/levels/use-levels";

/** Sentences and messages (phase F): spelling in whole texts, never grammar. */
export default function WritePage() {
  const { t } = useI18n();
  const { profile, setArea } = useLevels();
  return (
    <Page title={t.writing.title} intro={t.writing.intro}>
      <div className="space-y-8">
        <ul className="grid gap-4 md:grid-cols-2">
          <li>
            <Link href="/write/free" className="panel flex h-full min-h-40 flex-col gap-3 p-6 transition-colors hover:bg-raised">
              <PenLine className="size-7 text-fg-2" aria-hidden="true" />
              <span className="text-xl font-semibold">{t.writing.freeTitle}</span>
              <span className="text-fg-2">{t.writing.freeDesc}</span>
            </Link>
          </li>
          <li>
            <Link href="/write/dictation" className="panel flex h-full min-h-40 flex-col gap-3 p-6 transition-colors hover:bg-raised">
              <Headphones className="size-7 text-fg-2" aria-hidden="true" />
              <span className="text-xl font-semibold">{t.writing.dictTitle}</span>
              <span className="text-fg-2">{t.writing.dictDesc}</span>
            </Link>
          </li>
        </ul>
        {profile.status === "ready" ? <LevelsCard levels={profile.data.levels} onChange={setArea} areas={["sentences"]} /> : <LoadingBlock label={t.common.loading} />}
        <p className="max-w-2xl text-sm text-fg-2">{t.writing.honest}</p>
      </div>
    </Page>
  );
}
