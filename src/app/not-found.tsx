"use client";

import Link from "next/link";
import { useI18n } from "@/i18n";
import { Page } from "@/components/page";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <Page title={t.notFound.title} intro={t.notFound.body} width="narrow">
      <div className="flex gap-4">
        <Link href="/" className="font-medium text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg-2">
          {t.nav.home}
        </Link>
        <Link href="/play" className="font-medium text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg-2">
          {t.nav.play}
        </Link>
      </div>
    </Page>
  );
}
