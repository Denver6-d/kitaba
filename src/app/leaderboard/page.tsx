"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import { validateNickname } from "@/domain/leaderboard/nickname";
import { useI18n } from "@/i18n";
import type { PublicScore } from "@/repositories/types";
import { Page, LoadingBlock, ErrorBlock, EmptyBlock } from "@/components/page";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/features/account/account-provider";
import { useLeaderboard } from "@/features/leaderboard/use-leaderboard";

type Load<T> = { status: "loading" } | { status: "error" } | { status: "ready"; data: T };

export default function LeaderboardPage() {
  const { t } = useI18n();
  const { configured, user, ready, unavailable, retryLoad } = useAccount();
  const board = useLeaderboard();
  const [rows, setRows] = useState<Load<PublicScore[]>>({ status: "loading" });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!board) return;
    let alive = true;
    board
      .weekly()
      .then((data) => {
        if (alive) setRows({ status: "ready", data });
      })
      .catch(() => {
        if (alive) setRows({ status: "error" });
      });
    return () => {
      alive = false;
    };
  }, [board, nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return (
    <Page title={t.leaderboard.title} intro={t.leaderboard.intro}>
      {configured && !ready ? (
        <LoadingBlock label={t.common.loading} />
      ) : configured && unavailable ? (
        <ErrorBlock title={t.common.errorTitle} body={t.account.errors.generic} onRetry={retryLoad} retryLabel={t.common.retry} />
      ) : !configured || !board ? (
        <div className="sheet flex flex-col items-start gap-4 p-6 sm:p-8">
          <Trophy className="size-8 text-brass" aria-hidden="true" />
          <h2 className="text-xl font-semibold">{t.leaderboard.notConfiguredTitle}</h2>
          <p className="max-w-xl text-ink-soft">{t.leaderboard.notConfigured}</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="h-11">
              <Link href="/play">{t.nav.play}</Link>
            </Button>
            <Button asChild variant="outline" className="h-11">
              <Link href="/progress">{t.nav.progress}</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <section className="space-y-4">
            <BoardTable rows={rows} onRetry={refresh} />
            <p className="text-sm text-ink-soft">
              {t.leaderboard.rules} {t.leaderboard.resets}
            </p>
            <p className="rounded-xl bg-brass-wash p-4 text-sm">{t.leaderboard.honest}</p>
          </section>
          <aside>{user ? <Membership key={user.id} onChange={refresh} /> : <SignInPrompt />}</aside>
        </div>
      )}
    </Page>
  );
}

function BoardTable({ rows, onRetry }: { rows: Load<PublicScore[]>; onRetry: () => void }) {
  const { t, num } = useI18n();
  if (rows.status === "loading") return <LoadingBlock label={t.common.loading} />;
  if (rows.status === "error") return <ErrorBlock title={t.common.errorTitle} body={t.account.errors.generic} onRetry={onRetry} retryLabel={t.common.retry} />;
  if (rows.data.length === 0) return <EmptyBlock>{t.leaderboard.empty}</EmptyBlock>;
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-rule text-sm text-ink-soft">
          <th scope="col" className="py-2 text-start font-normal">{t.leaderboard.rank}</th>
          <th scope="col" className="py-2 text-start font-normal">{t.leaderboard.nickname}</th>
          <th scope="col" className="py-2 text-start font-normal">{t.leaderboard.points}</th>
          <th scope="col" className="hidden py-2 text-start font-normal sm:table-cell">{t.leaderboard.words}</th>
        </tr>
      </thead>
      <tbody className="tabular">
        {rows.data.map((r) => (
          <tr key={`${r.rank}-${r.nickname}`} className="border-b border-rule/60">
            <td className="py-3">{num(r.rank)}</td>
            {/* Nicknames are user content: rendered as text, isolated for bidi. */}
            <td className="py-3 font-medium">
              <bdi>{r.nickname}</bdi>
            </td>
            <td className="py-3 font-semibold">{num(r.points)}</td>
            <td className="hidden py-3 sm:table-cell">{num(r.words)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SignInPrompt() {
  const { t } = useI18n();
  return (
    <div className="space-y-3 rounded-xl border border-rule p-5">
      <p>{t.leaderboard.needAccount}</p>
      <Button asChild className="h-10">
        <Link href="/account">{t.account.signIn}</Link>
      </Button>
    </div>
  );
}

function Membership({ onChange }: { onChange: () => void }) {
  const { t } = useI18n();
  const board = useLeaderboard();
  const [nick, setNick] = useState<Load<string | null>>({ status: "loading" });
  const [value, setValue] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const id = useId();

  useEffect(() => {
    if (!board) return;
    let alive = true;
    board
      .myNickname()
      .then((n) => {
        if (!alive) return;
        setNick({ status: "ready", data: n });
        setValue(n ?? "");
      })
      .catch(() => alive && setNick({ status: "error" }));
    return () => {
      alive = false;
    };
  }, [board]);

  if (!board || nick.status === "loading") return <LoadingBlock label={t.common.loading} />;
  if (nick.status === "error") return <ErrorBlock title={t.common.errorTitle} body={t.account.errors.generic} />;

  const save = async () => {
    const v = validateNickname(value);
    if (!v.ok) return setMessage({ kind: "error", text: t.leaderboard.nicknameErrors[v.error] ?? "" });
    setBusy(true);
    try {
      const status = await board.setNickname(v.value);
      if (status === "ok") {
        setNick({ status: "ready", data: v.value });
        setMessage({ kind: "ok", text: `${t.leaderboard.onBoardAs} ${v.value}` });
        onChange();
      } else {
        setMessage({ kind: "error", text: t.leaderboard.nicknameErrors[status] ?? t.account.errors.generic });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 rounded-xl border border-rule p-5">
      {nick.data && (
        <p className="font-medium">
          {t.leaderboard.onBoardAs}
          <bdi className="ms-1">{nick.data}</bdi>
        </p>
      )}
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label htmlFor={id} className="block text-sm font-medium">
          {t.leaderboard.nickname}
        </label>
        <input
          id={id}
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, 30))}
          dir="auto"
          autoComplete="nickname"
          aria-describedby={`${id}-hint`}
          className="h-11 w-full rounded-lg border border-input bg-sheet px-3"
        />
        <p id={`${id}-hint`} className="text-xs text-ink-soft">
          {t.leaderboard.nicknameHint}
        </p>
        <Button type="submit" className="h-10" disabled={busy}>
          {nick.data ? t.leaderboard.save : t.leaderboard.join}
        </Button>
      </form>
      <p role="status" className={`min-h-5 text-sm ${message?.kind === "error" ? "text-error" : "text-correct"}`}>
        {message?.text}
      </p>
      {nick.data && (
        <div className="space-y-2 border-t border-rule pt-4">
          {confirmLeave ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="destructive"
                className="h-10"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await board.leave();
                    setNick({ status: "ready", data: null });
                    setValue("");
                    setMessage({ kind: "ok", text: t.leaderboard.left });
                    setConfirmLeave(false);
                    onChange();
                  } catch {
                    setMessage({ kind: "error", text: t.account.errors.generic });
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {t.leaderboard.leaveConfirm}
              </Button>
              <Button variant="ghost" className="h-10" disabled={busy} onClick={() => setConfirmLeave(false)}>
                {t.common.cancel}
              </Button>
            </div>
          ) : (
            <Button variant="outline" className="h-10" disabled={busy} onClick={() => setConfirmLeave(true)}>
              {t.leaderboard.leave}
            </Button>
          )}
          <p className="text-xs text-ink-soft">{t.leaderboard.leaveHint}</p>
        </div>
      )}
    </div>
  );
}
