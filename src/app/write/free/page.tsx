"use client";

import { useI18n } from "@/i18n";
import { Page, LoadingBlock } from "@/components/page";
import { useLevels } from "@/features/levels/use-levels";
import { FreeWriting } from "@/features/writing/free-writing";

export default function FreeWritingPage() {
  const { t } = useI18n();
  const { profile } = useLevels();
  return (
    <Page title={t.writing.freeTitle} width="narrow">
      {profile.status === "ready" ? <FreeWriting key={profile.data.levels.sentences} level={profile.data.levels.sentences} /> : <LoadingBlock label={t.common.loading} />}
    </Page>
  );
}
