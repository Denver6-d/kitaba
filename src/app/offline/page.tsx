"use client";

import Link from "next/link";
import { useI18n } from "@/i18n";
import { Page } from "@/components/page";

/** Served by the service worker when a page is requested offline and is not cached. */
export default function OfflinePage() {
  const { t } = useI18n();
  return (
    <Page title={t.offline.title} intro={t.offline.body} width="narrow">
      <Link href="/play" className="font-medium text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg-2">
        {t.nav.play}
      </Link>
    </Page>
  );
}
