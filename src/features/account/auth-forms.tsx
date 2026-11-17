"use client";

import { useId, useState } from "react";
import { z } from "zod";
import type { AuthError } from "@supabase/supabase-js";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAccount } from "./account-provider";

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
/** 8+ characters; bcrypt reads at most 72 bytes, and Arabic letters take 2 bytes each in UTF-8. */
export const passwordSchema = z
  .string()
  .min(8)
  .refine((p) => new TextEncoder().encode(p).length <= 72);

type Message = { kind: "ok" | "error"; text: string } | null;

const callbackUrl = (next = "/account") => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

export function useAuthErrorText() {
  const { t } = useI18n();
  return (e: AuthError | Error | null | undefined): string => {
    if (!e) return t.account.errors.generic;
    const status = "status" in e ? e.status : undefined;
    if (status === 429 || /rate limit/i.test(e.message)) return t.account.errors.rateLimit;
    if (/invalid login credentials/i.test(e.message)) return t.account.errors.credentials;
    return t.account.errors.generic;
  };
}

export function AuthForms() {
  const { t } = useI18n();
  return (
    <Tabs defaultValue="signin" className="w-full max-w-md">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="signin">{t.account.signIn}</TabsTrigger>
        <TabsTrigger value="signup">{t.account.signUp}</TabsTrigger>
      </TabsList>
      <TabsContent value="signin" className="pt-4">
        <SignInForm />
      </TabsContent>
      <TabsContent value="signup" className="pt-4">
        <SignUpForm />
      </TabsContent>
    </Tabs>
  );
}

function Field({ label, type, value, onChange, autoComplete, hint }: { label: string; type: string; value: string; onChange: (v: string) => void; autoComplete: string; hint?: string }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        dir="ltr"
        required
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="h-11 w-full rounded-lg border border-input bg-sheet px-3 focus:border-brass-fill"
      />
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-ink-soft">
          {hint}
        </p>
      )}
    </div>
  );
}

function Status({ message }: { message: Message }) {
  return (
    <p role={message?.kind === "error" ? "alert" : "status"} className={`min-h-5 text-sm ${message?.kind === "error" ? "text-error" : "text-correct"}`}>
      {message?.text}
    </p>
  );
}

function SignInForm() {
  const { t } = useI18n();
  const { client } = useAccount();
  const errorText = useAuthErrorText();
  const [mode, setMode] = useState<"password" | "magic" | "reset">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  const submit = async () => {
    if (!client) return;
    const e = emailSchema.safeParse(email);
    if (!e.success) return setMessage({ kind: "error", text: t.account.errors.invalidEmail });
    setBusy(true);
    setMessage(null);
    try {
      if (mode === "password") {
        if (!passwordSchema.safeParse(password).success) return setMessage({ kind: "error", text: t.account.errors.shortPassword });
        const { error } = await client.auth.signInWithPassword({ email: e.data, password });
        if (error) setMessage({ kind: "error", text: errorText(error) });
      } else if (mode === "magic") {
        const { error } = await client.auth.signInWithOtp({ email: e.data, options: { emailRedirectTo: callbackUrl(), shouldCreateUser: false } });
        setMessage(error ? { kind: "error", text: errorText(error) } : { kind: "ok", text: t.account.magicSent });
      } else {
        const { error } = await client.auth.resetPasswordForEmail(e.data, { redirectTo: callbackUrl("/account/reset") });
        // Same message whether or not the address exists (no account enumeration).
        setMessage(error && error.status === 429 ? { kind: "error", text: errorText(error) } : { kind: "ok", text: t.account.resetSent });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Field label={t.account.email} type="email" value={email} onChange={setEmail} autoComplete="email" />
      {mode === "password" && <Field label={t.account.password} type="password" value={password} onChange={setPassword} autoComplete="current-password" />}
      <Button type="submit" size="lg" className="h-11 w-full" disabled={busy} aria-busy={busy}>
        {mode === "password" ? t.account.signIn : mode === "magic" ? t.account.magicLink : t.account.forgot}
      </Button>
      <Status message={message} />
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <button type="button" className="text-ink-soft underline underline-offset-4" onClick={() => setMode(mode === "magic" ? "password" : "magic")}>
          {mode === "magic" ? t.account.usePassword : t.account.useMagic}
        </button>
        {mode !== "reset" && (
          <button type="button" className="text-ink-soft underline underline-offset-4" onClick={() => setMode("reset")}>
            {t.account.forgot}
          </button>
        )}
      </div>
    </form>
  );
}

function SignUpForm() {
  const { t } = useI18n();
  const { client } = useAccount();
  const errorText = useAuthErrorText();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  const submit = async () => {
    if (!client) return;
    const e = emailSchema.safeParse(email);
    if (!e.success) return setMessage({ kind: "error", text: t.account.errors.invalidEmail });
    if (!passwordSchema.safeParse(password).success) return setMessage({ kind: "error", text: t.account.errors.shortPassword });
    setBusy(true);
    try {
      const { data, error } = await client.auth.signUp({ email: e.data, password, options: { emailRedirectTo: callbackUrl() } });
      if (error) setMessage({ kind: "error", text: errorText(error) });
      else if (!data.session) setMessage({ kind: "ok", text: t.account.checkEmail });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Field label={t.account.email} type="email" value={email} onChange={setEmail} autoComplete="email" />
      <Field label={t.account.password} type="password" value={password} onChange={setPassword} autoComplete="new-password" hint={t.account.passwordHint} />
      <Button type="submit" size="lg" className="h-11 w-full" disabled={busy} aria-busy={busy}>
        {t.account.signUp}
      </Button>
      <Status message={message} />
    </form>
  );
}
