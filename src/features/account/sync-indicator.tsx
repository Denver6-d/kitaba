"use client";

import Link from "next/link";
import { Cloud, CloudOff, RefreshCw, TriangleAlert } from "lucide-react";
import { useI18n } from "@/i18n";
import { useAccount } from "./account-provider";

/** Small status in the header. Guests (or sites without accounts) see nothing. */
export function SyncIndicator() {
  const { t } = useI18n();
  const { user, sync } = useAccount();
  if (!user || !sync) return null;
  const s = t.account.syncStatus;
  const { icon: Icon, label, tone } =
    sync.status === "syncing"
      ? { icon: RefreshCw, label: s.syncing, tone: "text-ink-soft" }
      : sync.status === "offline"
        ? { icon: CloudOff, label: s.offline(sync.pending), tone: "text-brass" }
        : sync.status === "error"
          ? { icon: TriangleAlert, label: s.error, tone: "text-error" }
          : sync.pending > 0
            ? { icon: Cloud, label: s.pending(sync.pending), tone: "text-ink-soft" }
            : { icon: Cloud, label: s.synced, tone: "text-correct" };
  return (
    <Link href="/account" className={`hidden items-center gap-1.5 rounded-md px-2 py-1.5 text-xs sm:inline-flex ${tone}`} title={label}>
      <Icon className={`size-4 ${sync.status === "syncing" ? "motion-safe:animate-spin" : ""}`} aria-hidden="true" />
      <span className="sr-only md:not-sr-only" role="status">
        {label}
      </span>
    </Link>
  );
}
