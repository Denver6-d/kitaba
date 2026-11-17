"use client";

import { useI18n } from "@/i18n";
import { useAccount } from "./account-provider";

/** Plain-text sync status for the account page. */
export function SyncIndicatorText() {
  const { t } = useI18n();
  const { sync } = useAccount();
  const s = t.account.syncStatus;
  if (!sync) return <span className="text-sm text-ink-soft">{s.guest}</span>;
  const label =
    sync.status === "syncing"
      ? s.syncing
      : sync.status === "offline"
        ? s.offline(sync.pending)
        : sync.status === "error"
          ? s.error
          : sync.pending > 0
            ? s.pending(sync.pending)
            : s.synced;
  return (
    <span role="status" className={`text-sm ${sync.status === "error" ? "text-error" : "text-ink-soft"}`}>
      {t.account.sync}: {label}
    </span>
  );
}
