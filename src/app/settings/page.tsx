"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { ClipboardCheck, Download, FileSpreadsheet, Upload, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n";
import { useSettings } from "@/lib/settings-store";
import { TEXT_SCALES } from "@/lib/settings";
import { canVibrate } from "@/lib/haptics";
import { useHydrated } from "@/lib/use-hydrated";
import { downloadJson, exportFilename } from "@/lib/download";
import { parseExportFile } from "@/repositories/export";
import { CSV_TABLES, type CsvTableName } from "@/features/export/progress-csv";
import { csvLabels, downloadProgressCsv } from "@/features/export/download-progress-csv";
import { useRepos } from "@/repositories/provider";
import { Page } from "@/components/page";
import { Segmented } from "@/components/segmented";
import { Switch } from "@/components/ui/switch";
import { OfflineLibrary } from "@/features/library/offline-library";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function SettingsPage() {
  const { t, pct, lang } = useI18n();
  const [s, update] = useSettings();
  const hydrated = useHydrated();
  const repos = useRepos();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [csvBusy, setCsvBusy] = useState<CsvTableName | null>(null);

  const onCsv = async (name: CsvTableName) => {
    setCsvBusy(name);
    try {
      await downloadProgressCsv(repos, name, csvLabels(t, lang));
    } catch {
      setMessage({ kind: "error", text: t.settings.csv.failed });
    } finally {
      setCsvBusy(null);
    }
  };

  const onImport = async (file: File) => {
    try {
      const parsed = parseExportFile(await file.text());
      await repos.data.importAll(parsed, mode);
      setMessage({ kind: "ok", text: t.settings.imported });
    } catch (e) {
      const code = e instanceof Error ? e.message : "invalid-format";
      setMessage({ kind: "error", text: t.settings.importErrors[code] ?? t.settings.importErrors["invalid-format"] ?? "" });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Page title={t.settings.title} width="narrow">
      <div className="space-y-10">
        <section className="space-y-6">
          <Segmented legend={t.settings.language} value={s.lang} onChange={(lang) => update({ lang })} options={[{ value: "ar", label: "العربية" }, { value: "en", label: "English" }]} />
          <div className="space-y-2">
            <Segmented
              legend={t.settings.accent}
              value={s.accent}
              onChange={(accent) => update({ accent })}
              options={(["us", "uk"] as const).map((v) => ({ value: v, label: t.settings.accents[v] }))}
            />
            <p className="text-sm text-fg-2">{t.settings.accentHint}</p>
          </div>
          <Segmented
            legend={t.settings.textSize}
            value={s.textScale}
            onChange={(textScale) => update({ textScale })}
            options={TEXT_SCALES.map((v) => ({ value: v, label: pct(Math.round(v * 100)) }))}
          />
          <Segmented
            legend={t.settings.motion}
            value={s.motion}
            onChange={(motion) => update({ motion })}
            options={(["system", "reduce", "full"] as const).map((v) => ({ value: v, label: t.settings.motions[v] }))}
          />
          <div className="divide-y divide-line border-y border-line">
            <Toggle label={t.settings.readableFont} hint={t.settings.readableFontHint} checked={s.readableFont} onChange={(readableFont) => update({ readableFont })} />
            <Toggle label={t.settings.sounds} hint={t.settings.soundsHint} checked={s.sounds} onChange={(sounds) => update({ sounds })} />
            <Toggle
              label={t.settings.haptics}
              hint={hydrated && !canVibrate() ? `${t.settings.hapticsHint} ${t.settings.hapticsUnsupported}` : t.settings.hapticsHint}
              checked={s.haptics && (!hydrated || canVibrate())}
              disabled={hydrated && !canVibrate()}
              onChange={(haptics) => update({ haptics })}
            />
          </div>
        </section>

        <section aria-labelledby="levels-h" className="space-y-3">
          <h2 id="levels-h" className="text-2xl font-light">
            {t.levels.title}
          </h2>
          <p className="text-fg-2">{t.levels.retakeHint}</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" className="h-11 gap-2">
              <Link href="/welcome?retake=1">
                <ClipboardCheck className="size-4" aria-hidden="true" />
                {t.levels.retake}
              </Link>
            </Button>
            <Button asChild variant="quiet" className="h-11">
              <Link href="/play">{t.levels.choose}</Link>
            </Button>
          </div>
        </section>

        <OfflineLibrary />

        <section aria-labelledby="data-h" className="space-y-4">
          <h2 id="data-h" className="text-2xl font-light">
            {t.settings.data}
          </h2>
          <p className="text-sm text-fg-2">{t.settings.dataIntro}</p>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="h-10 gap-2" onClick={async () => downloadJson(await repos.data.exportAll(), exportFilename())}>
              <Download className="size-4" aria-hidden="true" />
              {t.settings.export}
            </Button>
          </div>
          <div className="space-y-3 rounded-xl border border-line p-4">
            <h3 className="font-medium">{t.settings.csv.title}</h3>
            <p className="text-sm text-fg-2">{t.settings.csv.intro}</p>
            <div className="flex flex-wrap gap-3">
              {CSV_TABLES.map((name) => (
                <Button key={name} variant="outline" className="h-10 gap-2" disabled={csvBusy !== null} aria-busy={csvBusy === name} onClick={() => void onCsv(name)}>
                  <FileSpreadsheet className="size-4" aria-hidden="true" />
                  {t.settings.csv.buttons[name]}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-3 rounded-xl border border-line p-4">
            <Segmented
              legend={t.settings.import}
              value={mode}
              onChange={setMode}
              options={[
                { value: "merge", label: t.settings.importMerge },
                { value: "replace", label: t.settings.importReplace },
              ]}
            />
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              id="import-file"
              aria-label={t.settings.import}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onImport(f);
              }}
            />
            <Button variant="outline" className="h-10 gap-2" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" aria-hidden="true" />
              {t.settings.import}
            </Button>
          </div>
          <p role="status" className={`min-h-5 text-sm ${message?.kind === "error" ? "text-error" : "text-fg"}`}>
            {message?.text}
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="h-10 gap-2">
                <Trash2 className="size-4" aria-hidden="true" />
                {t.settings.clear}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogTitle>{t.settings.clear}</AlertDialogTitle>
              <AlertDialogDescription>{t.settings.clearConfirm}</AlertDialogDescription>
              <AlertDialogFooter>
                <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={async () => {
                    await repos.data.clearAll();
                    setMessage({ kind: "ok", text: t.settings.cleared });
                  }}
                >
                  {t.settings.clear}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      </div>
    </Page>
  );
}

function Toggle({ label, hint, checked, onChange, disabled = false }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-6 py-4">
      <div className="space-y-1">
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
        {hint && (
          <p id={`${id}-hint`} className="text-sm text-fg-2">
            {hint}
          </p>
        )}
      </div>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} aria-describedby={hint ? `${id}-hint` : undefined} />
    </div>
  );
}
