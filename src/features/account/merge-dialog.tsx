"use client";

import { useState } from "react";
import { useI18n } from "@/i18n";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type MergeChoice = "merge" | "backup" | "separate";

/**
 * Shown on first sign-in when this device already has progress. A choice is required.
 * "Keep separate" is two steps: save the backup file, then confirm the replacement,
 * so a blocked or cancelled download can never lose the only copy.
 */
export function MergeDialog({ open, onChoose }: { open: boolean; onChoose: (c: MergeChoice) => Promise<void> }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"choose" | "confirm">("choose");
  const [failed, setFailed] = useState(false);

  const run = async (c: MergeChoice) => {
    setBusy(true);
    setFailed(false);
    try {
      await onChoose(c);
      if (c === "backup") setStep("confirm");
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false} onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()} className="max-w-md">
        <DialogTitle>{t.account.mergeTitle}</DialogTitle>
        <DialogDescription>{step === "choose" ? t.account.mergeBody : t.account.backupConfirm}</DialogDescription>
        {step === "choose" ? (
          <div className="mt-2 space-y-4">
            <div className="space-y-1">
              <Button variant="primary" className="h-11 w-full" disabled={busy} onClick={() => void run("merge")}>
                {t.account.mergeYes}
              </Button>
              <p className="text-xs text-fg-2">{t.account.mergeYesHint}</p>
            </div>
            <div className="space-y-1">
              <Button variant="outline" className="h-11 w-full" disabled={busy} onClick={() => void run("backup")}>
                {t.account.mergeNo}
              </Button>
              <p className="text-xs text-fg-2">{t.account.mergeNoHint}</p>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap gap-3">
            <Button variant="destructive" className="h-11" disabled={busy} onClick={() => void run("separate")}>
              {t.account.backupSavedReplace}
            </Button>
            <Button variant="outline" className="h-11" disabled={busy} onClick={() => void run("backup")}>
              {t.account.backupAgain}
            </Button>
            <Button variant="quiet" className="h-11" disabled={busy} onClick={() => setStep("choose")}>
              {t.common.back}
            </Button>
          </div>
        )}
        {failed && (
          <p role="alert" className="text-sm text-error">
            {t.account.errors.generic}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
