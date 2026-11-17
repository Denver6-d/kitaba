"use client";

import { useEffect, useId, useState } from "react";
import { z } from "zod";
import type { AuthError } from "@supabase/supabase-js";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAccount } from "./account-provider";
import {
  callbackUrl,
  OAUTH_PROVIDERS,
  PROVIDER_LABELS,
  type OAuthProvider,
} from "@/lib/auth-redirect";

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
/** 8+ characters; bcrypt reads at most 72 bytes, and Arabic letters take 2 bytes each in UTF-8. */
export const passwordSchema = z
  .string()
  .min(8)
  .refine((p) => new TextEncoder().encode(p).length <= 72);

type Message = { kind: "ok" | "error"; text: string } | null;

/** This site's own callback (see lib/auth-redirect.ts); never an address taken from the URL. */
const redirectTo = (next = "/account"): string =>
  callbackUrl(window.location.origin, next) ?? `${window.location.origin}/auth/callback`;

export function useAuthErrorText() {
  const { t } = useI18n();
  return (e: AuthError | Error | null | undefined): string => {
    if (!e) return t.account.errors.generic;
    const status = "status" in e ? e.status : undefined;
    if (status === 429 || /rate limit/i.test(e.message))
      return t.account.errors.rateLimit;
    if (/invalid login credentials/i.test(e.message))
      return t.account.errors.credentials;
    return t.account.errors.generic;
  };
}

/** Google and GitHub sign-in (Supabase OAuth with PKCE). Client ids and secrets live only in the Supabase dashboard. */
function OAuthButtons() {
  const { t } = useI18n();
  const { client } = useAccount();
  const [busy, setBusy] = useState<OAuthProvider | null>(null);
  const [failed, setFailed] = useState(false);
  // Coming back with the browser's Back button can restore this page from the
  // back/forward cache with the buttons still disabled: re-enable them.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) setBusy(null);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);
  if (!client) return null;
  const go = async (provider: OAuthProvider) => {
    setBusy(provider);
    setFailed(false);
    try {
      const { error } = await client.auth.signInWithOAuth({ provider, options: { redirectTo: redirectTo("/account") } });
      // On success the browser leaves for the provider; we only stay here on an error.
      if (error) {
        setFailed(true);
        setBusy(null);
      }
    } catch {
      setFailed(true);
      setBusy(null);
    }
  };
  return (
    <div className="space-y-3">
      {OAUTH_PROVIDERS.map((p) => (
        <Button
          key={p}
          type="button"
          variant="outline"
          size="lg"
          className="h-12 w-full gap-3 text-base"
          disabled={busy !== null}
          onClick={() => void go(p)}
        >
          {p === "google" ? <GoogleMark /> : <GitHubMark />}
          {t.account.continueWith(PROVIDER_LABELS[p])}
        </Button>
      ))}
      {failed && (
        <p role="alert" className="text-sm text-error">
          {t.account.oauthError}
        </p>
      )}
      <p className="flex items-center gap-3 pt-2 text-sm text-ink-soft before:h-px before:flex-1 before:bg-rule after:h-px after:flex-1 after:bg-rule">
        {t.account.orEmail}
      </p>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h6a5.1 5.1 0 0 1-2.2 3.3v2.8h3.6c2.1-1.9 3.2-4.8 3.2-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.9A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7H2.1a11 11 0 0 0 0 10z"
      />
      <path
        fill="#EA4335"
        d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7l3.7 2.9C6.7 7.3 9.1 5.4 12 5.4z"
      />
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M12 .5a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .5z" />
    </svg>
  );
}

export function AuthForms() {
  const { t } = useI18n();
  return (
    <div className="w-full max-w-md space-y-4">
      <OAuthButtons />
      <Tabs defaultValue="signin" className="w-full">
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
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
  hint,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  hint?: string;
}) {
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
    <p
      role={message?.kind === "error" ? "alert" : "status"}
      className={`min-h-5 text-sm ${message?.kind === "error" ? "text-error" : "text-correct"}`}
    >
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
    if (!e.success)
      return setMessage({ kind: "error", text: t.account.errors.invalidEmail });
    setBusy(true);
    setMessage(null);
    try {
      if (mode === "password") {
        if (!passwordSchema.safeParse(password).success)
          return setMessage({
            kind: "error",
            text: t.account.errors.shortPassword,
          });
        const { error } = await client.auth.signInWithPassword({
          email: e.data,
          password,
        });
        if (error) setMessage({ kind: "error", text: errorText(error) });
      } else if (mode === "magic") {
        const { error } = await client.auth.signInWithOtp({
          email: e.data,
          options: { emailRedirectTo: redirectTo(), shouldCreateUser: false },
        });
        setMessage(
          error
            ? { kind: "error", text: errorText(error) }
            : { kind: "ok", text: t.account.magicSent },
        );
      } else {
        const { error } = await client.auth.resetPasswordForEmail(e.data, {
          redirectTo: redirectTo("/account/reset"),
        });
        // Same message whether or not the address exists (no account enumeration).
        setMessage(
          error && error.status === 429
            ? { kind: "error", text: errorText(error) }
            : { kind: "ok", text: t.account.resetSent },
        );
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
      <Field
        label={t.account.email}
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
      />
      {mode === "password" && (
        <Field
          label={t.account.password}
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />
      )}
      <Button
        type="submit"
        size="lg"
        className="h-11 w-full"
        disabled={busy}
        aria-busy={busy}
      >
        {mode === "password"
          ? t.account.signIn
          : mode === "magic"
            ? t.account.magicLink
            : t.account.forgot}
      </Button>
      <Status message={message} />
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <button
          type="button"
          className="text-ink-soft underline underline-offset-4"
          onClick={() => setMode(mode === "magic" ? "password" : "magic")}
        >
          {mode === "magic" ? t.account.usePassword : t.account.useMagic}
        </button>
        {mode !== "reset" && (
          <button
            type="button"
            className="text-ink-soft underline underline-offset-4"
            onClick={() => setMode("reset")}
          >
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
    if (!e.success)
      return setMessage({ kind: "error", text: t.account.errors.invalidEmail });
    if (!passwordSchema.safeParse(password).success)
      return setMessage({
        kind: "error",
        text: t.account.errors.shortPassword,
      });
    setBusy(true);
    try {
      const { data, error } = await client.auth.signUp({
        email: e.data,
        password,
        options: { emailRedirectTo: redirectTo() },
      });
      if (error) setMessage({ kind: "error", text: errorText(error) });
      else if (!data.session)
        setMessage({ kind: "ok", text: t.account.checkEmail });
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
      <Field
        label={t.account.email}
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
      />
      <Field
        label={t.account.password}
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        hint={t.account.passwordHint}
      />
      <Button
        type="submit"
        size="lg"
        className="h-11 w-full"
        disabled={busy}
        aria-busy={busy}
      >
        {t.account.signUp}
      </Button>
      <Status message={message} />
    </form>
  );
}
