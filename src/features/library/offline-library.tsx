"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CloudDownload, RotateCcw, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { getAudioLibrary } from "@/features/audio/audio-library";
import { getLibrary, type OfflineStatus } from "./library";
import { combineOffline } from "./offline-sources";

/** The word library plus the pronunciation audio, as one download (DECISIONS AU10). */
const offline = () => combineOffline(getLibrary(), getAudioLibrary());

type State =
  | { readonly kind: "checking" }
  | { readonly kind: "no-storage" }
  | { readonly kind: "unreachable" }
  | { readonly kind: "idle"; readonly stored: number; readonly total: number }
  | { readonly kind: "downloading"; readonly stored: number; readonly total: number }
  | { readonly kind: "failed"; readonly stored: number; readonly total: number };

const toState = (s: OfflineStatus, ok = true): State => (s.kind === "ready" ? { kind: ok ? "idle" : "failed", stored: s.stored, total: s.total } : s);

/**
 * Settings: store the whole open-data library for offline play (DECISIONS OD13).
 * Progress is shown as a percentage and megabytes, never as a number of words.
 */
export function OfflineLibrary() {
  const { t, pct, num } = useI18n();
  const mb = (bytes: number) => num(bytes / 1_000_000, 1);
  const [state, setState] = useState<State>({ kind: "checking" });
  const abort = useRef<AbortController | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  const check = useCallback(() => {
    setState({ kind: "checking" });
    void offline()
      .offlineStatus()
      .then((s) => setState(toState(s)));
  }, []);

  useEffect(() => {
    let alive = true;
    void offline()
      .offlineStatus()
      .then((s) => alive && setState(toState(s)));
    return () => {
      alive = false;
      abort.current?.abort();
    };
  }, []);

  const download = async () => {
    if (state.kind !== "idle" && state.kind !== "failed") return;
    const ctrl = new AbortController();
    abort.current = ctrl;
    setState({ kind: "downloading", stored: state.stored, total: state.total });
    // The button is disabled while downloading: keep keyboard focus on the live status.
    statusRef.current?.focus();
    const ok = await offline().downloadAll((stored, total) => setState({ kind: "downloading", stored, total }), ctrl.signal);
    if (ctrl.signal.aborted) return;
    setState(toState(await offline().offlineStatus(), ok));
  };

  const remove = async () => {
    await offline().removeOffline();
    setState(toState(await offline().offlineStatus()));
    statusRef.current?.focus();
  };

  const percent = (s: { stored: number; total: number }) => pct(s.total ? Math.floor((s.stored / s.total) * 100) : 0);
  const complete = state.kind === "idle" && state.total > 0 && state.stored >= state.total;

  return (
    <section aria-labelledby="offline-h" className="space-y-3">
      <h2 id="offline-h" className="text-2xl font-light">
        {t.settings.offlineTitle}
      </h2>
      <p className="text-fg-2">{t.settings.offlineBody}</p>
      <div ref={statusRef} tabIndex={-1} aria-live="polite" className="space-y-3 outline-none">
        {state.kind === "checking" && <p className="text-sm text-fg-2">{t.common.loading}</p>}
        {state.kind === "no-storage" && <p className="text-sm text-fg-2">{t.settings.offlineUnavailable}</p>}
        {state.kind === "unreachable" && <p className="text-sm text-fg-2">{t.settings.offlineUnreachable}</p>}
        {complete && <p className="text-sm text-fg">{t.settings.offlineDone}</p>}
        {state.kind === "idle" && !complete && state.stored > 0 && <p className="text-sm text-fg-2">{t.settings.offlinePartial(percent(state))}</p>}
        {state.kind === "failed" && <p className="text-sm text-error">{t.settings.offlineFailed}</p>}
        {state.kind === "downloading" && (
          <div className="space-y-2">
            <p className="text-sm tabular">{t.settings.offlineDownloading(percent(state))}</p>
            <div
              className="h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={state.total ? Math.floor((state.stored / state.total) * 100) : 0}
              aria-label={t.settings.offlineTitle}
            >
              <div className="h-full bg-gold transition-[width]" style={{ width: `${state.total ? (state.stored / state.total) * 100 : 0}%` }} />
            </div>
          </div>
        )}
      </div>
      {state.kind === "unreachable" && (
        <Button variant="outline" className="h-11 gap-2" onClick={check}>
          <RotateCcw className="size-4" aria-hidden="true" />
          {t.common.retry}
        </Button>
      )}
      {(state.kind === "idle" || state.kind === "failed" || state.kind === "downloading") && (
        <div className="flex flex-wrap items-center gap-3">
          {!complete && (
            <Button variant="outline" className="h-11 gap-2" disabled={state.kind === "downloading"} onClick={() => void download()}>
              <CloudDownload className="size-4" aria-hidden="true" />
              {t.settings.offlineDownload}
            </Button>
          )}
          {state.kind !== "downloading" && <span className="text-sm text-fg-2 tabular">{t.settings.offlineSize(mb(state.total))}</span>}
          {state.kind === "idle" && state.stored > 0 && (
            <Button variant="quiet" className="h-11 gap-2" onClick={() => void remove()}>
              <Trash2 className="size-4" aria-hidden="true" />
              {t.settings.offlineRemove}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
