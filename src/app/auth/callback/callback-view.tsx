"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n";
import { Page, LoadingBlock, ErrorBlock } from "@/components/page";
import { useAccount } from "@/features/account/account-provider";
import { safeNext } from "@/lib/safe-next";

/**
 * Email links (sign-up confirmation, magic link, password reset) land here.
 * The browser client finishes the PKCE exchange from the ?code= parameter on
 * its own (detectSessionInUrl); we wait for the session, then move on.
 */
export function CallbackView() {
  const { t } = useI18n();
  const { client, user, ready } = useAccount();
  const params = useSearchParams();
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const next = safeNext(params.get("next"));
  const errorParam = params.get("error_description") ?? params.get("error");

  useEffect(() => {
    if (user) router.replace(next);
  }, [user, next, router]);

  useEffect(() => {
    if (!client || errorParam) return;
    const timer = window.setTimeout(() => setFailed(true), 10_000);
    return () => window.clearTimeout(timer);
  }, [client, errorParam]);

  return (
    <Page title={t.account.title} width="narrow">
      {errorParam || failed || (ready && !client) ? (
        <ErrorBlock title={t.common.errorTitle} body={t.account.errors.generic} />
      ) : (
        <LoadingBlock label={t.common.loading} />
      )}
    </Page>
  );
}
