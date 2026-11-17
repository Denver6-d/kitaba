"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { useI18n } from "@/i18n";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/features/account/account-provider";
import { passwordSchema, useAuthErrorText } from "@/features/account/auth-forms";

/** Reached from the password-reset email (via /auth/callback). */
export default function ResetPasswordPage() {
  const { t } = useI18n();
  const { client, user, configured } = useAccount();
  const errorText = useAuthErrorText();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const id = useId();

  if (!configured) return <Page title={t.account.newPassword}>{t.account.notConfigured}</Page>;

  return (
    <Page title={t.account.newPassword} width="narrow">
      {!user ? (
        <p className="text-ink-soft">
          <Link href="/account" className="underline underline-offset-4">
            {t.account.signIn}
          </Link>
        </p>
      ) : (
        <form
          className="max-w-md space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!passwordSchema.safeParse(password).success) return setMessage({ kind: "error", text: t.account.errors.shortPassword });
            const { error } = (await client?.auth.updateUser({ password })) ?? { error: null };
            setMessage(error ? { kind: "error", text: errorText(error) } : { kind: "ok", text: t.account.passwordUpdated });
          }}
        >
          <label htmlFor={id} className="block text-sm font-medium">
            {t.account.newPassword}
          </label>
          <input
            id={id}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            dir="ltr"
            className="h-11 w-full rounded-lg border border-input bg-sheet px-3"
          />
          <p className="text-xs text-ink-soft">{t.account.passwordHint}</p>
          <Button type="submit" size="lg" className="h-11">
            {t.account.setPassword}
          </Button>
          <p role="status" className={`min-h-5 text-sm ${message?.kind === "error" ? "text-error" : "text-correct"}`}>
            {message?.text}
          </p>
        </form>
      )}
    </Page>
  );
}
