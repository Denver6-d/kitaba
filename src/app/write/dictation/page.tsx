"use client";

import { useI18n } from "@/i18n";
import { Page, LoadingBlock } from "@/components/page";
import { useLevels } from "@/features/levels/use-levels";
import { Dictation } from "@/features/writing/dictation";

export default function DictationPage() {
  const { t } = useI18n();
  const { profile } = useLevels();
  return (
    <Page title={t.writing.dictTitle} width="narrow">
      {profile.status === "ready" ? <Dictation key={profile.data.levels.sentences} level={profile.data.levels.sentences} /> : <LoadingBlock label={t.common.loading} />}
    </Page>
  );
}
