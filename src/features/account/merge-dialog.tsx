"use client";

import { useState } from "react";
import { useI18n } from "@/i18n";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/** Shown on first sign-in when this device already has progress. A choice is required. */
export function MergeDialog({ open, onChoose }: { open: boolean; onChoose: (merge: boolean) => Promise<void> }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const choose = async (merge: boolean) => {
    setBusy(true);
    try {
      await onChoose(merge);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false} onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()} className="max-w-md">
        <DialogTitle>{t.account.mergeTitle}</DialogTitle>
        <DialogDescription>{t.account.mergeBody}</DialogDescription>
        <div className="mt-2 space-y-4">
          <div className="space-y-1">
            <Button className="h-11 w-full" disabled={busy} onClick={() => void choose(true)}>
              {t.account.mergeYes}
            </Button>
            <p className="text-xs text-ink-soft">{t.account.mergeYesHint}</p>
          </div>
          <div className="space-y-1">
            <Button variant="outline" className="h-11 w-full" disabled={busy} onClick={() => void choose(false)}>
              {t.account.mergeNo}
            </Button>
            <p className="text-xs text-ink-soft">{t.account.mergeNoHint}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
