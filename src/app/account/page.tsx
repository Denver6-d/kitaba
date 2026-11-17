"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Download, LogOut, RefreshCw, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n";
import { useRepos } from "@/repositories/provider";
import { downloadJson, exportFilename } from "@/lib/download";
import { Page, LoadingBlock } from "@/components/page";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/features/account/account-provider";
import { AuthForms } from "@/features/account/auth-forms";
import { SyncIndicatorText } from "@/features/account/sync-text";

export default function AccountPage() {
  const { t } = useI18n();
  const account = useAccount();

  return (
    <Page title={t.account.title} intro={t.account.intro} width="narrow">
      {!account.configured ? (
        <div className="rounded-xl border border-dashed border-rule-strong p-6">
          <p>{t.account.notConfigured}</p>
          <Link href="/privacy" className="mt-3 inline-block text-sm text-brass underline underline-offset-4">
            {t.nav.privacy}
          </Link>
        </div>
      ) : !account.ready ? (
        <LoadingBlock label={t.common.loading} />
      ) : account.user ? (
        <SignedIn />
      ) : (
        <AuthForms />
      )}
    </Page>
  );
}

function SignedIn() {
  const { t } = useI18n();
  const repos = useRepos();
  const { user, syncNow, signOut, exportCloud, deleteAccount } = useAccount();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const confirmId = useId();

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <p className="font-medium" dir="auto">
          {t.account.signedInAs(user?.email ?? "")}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <SyncIndicatorText />
          <Button variant="outline" className="h-9 gap-2" onClick={() => void syncNow()}>
            <RefreshCw className="size-4" aria-hidden="true" />
            {t.account.syncNow}
          </Button>
        </div>
        <Button variant="ghost" className="h-10 gap-2" onClick={() => void signOut()}>
          <LogOut className="size-4" aria-hidden="true" />
          {t.account.signOut}
        </Button>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">{t.account.dataTitle}</h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" className="h-10 gap-2" onClick={() => void exportCloud()}>
            <Download className="size-4" aria-hidden="true" />
            {t.account.exportCloud}
          </Button>
          <Button variant="outline" className="h-10 gap-2" onClick={async () => downloadJson(await repos.data.exportAll(), exportFilename())}>
            <Download className="size-4" aria-hidden="true" />
            {t.settings.export}
          </Button>
        </div>
      </section>

      <section aria-labelledby="delete-h" className="space-y-3 rounded-xl border border-error/40 p-5">
        <h2 id="delete-h" className="text-xl font-semibold text-error">
          {t.account.deleteTitle}
        </h2>
        <p className="text-sm">{t.account.deleteBody}</p>
        <label htmlFor={confirmId} className="block text-sm font-medium">
          {t.account.deleteConfirmLabel}
        </label>
        <input
          id={confirmId}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          dir="ltr"
          autoComplete="off"
          className="h-10 w-48 rounded-md border border-input bg-sheet px-3 font-mono"
        />
        <div>
          <Button
            variant="destructive"
            className="h-10 gap-2"
            disabled={confirm !== "DELETE" || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await deleteAccount();
                setMessage({ kind: "ok", text: t.account.deleted });
              } catch {
                setMessage({ kind: "error", text: t.account.errors.generic });
              } finally {
                setBusy(false);
              }
            }}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            {t.account.deleteButton}
          </Button>
        </div>
        <p role="status" className={`min-h-5 text-sm ${message?.kind === "error" ? "text-error" : "text-correct"}`}>
          {message?.text}
        </p>
      </section>
    </div>
  );
}
