"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { useI18n } from "@/i18n";
import { downloadBlob } from "@/lib/download";
import { Button } from "@/components/ui/button";

export interface ShareResultProps {
  readonly wpm: number;
  readonly accuracy: number;
  readonly mode: string;
}

const W = 1200;
const H = 630;

/** Reads a next/font family name from its CSS variable so canvas text uses the same faces. */
function fontFamily(variable: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return v ? `${v}, ${fallback}` : fallback;
}

/** Draws the result card on a canvas (no library). */
async function renderResultImage(p: ShareResultProps & { lang: "ar" | "en"; caption: string; accuracyLabel: string; wpmLabel: string }): Promise<Blob> {
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no-canvas");
  const display = fontFamily("--font-literata", "Georgia, serif");
  const ui = fontFamily(p.lang === "ar" ? "--font-cairo" : "--font-hanken", "system-ui, sans-serif");

  ctx.fillStyle = "#14302e";
  ctx.fillRect(0, 0, W, H);
  // Ruled baselines, the brand's signature.
  ctx.strokeStyle = "rgba(238, 241, 236, 0.07)";
  ctx.lineWidth = 1;
  for (let y = 90; y < H; y += 70) {
    ctx.beginPath();
    ctx.moveTo(80, y);
    ctx.lineTo(W - 80, y);
    ctx.stroke();
  }

  ctx.fillStyle = "#c8962e";
  ctx.beginPath();
  ctx.moveTo(98, 70);
  ctx.lineTo(118, 90);
  ctx.lineTo(80, 128);
  ctx.lineTo(68, 132);
  ctx.lineTo(72, 120);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#eef1ec";
  ctx.font = `600 34px ${fontFamily("--font-cairo", "sans-serif")}`;
  ctx.textAlign = "left";
  ctx.fillText("كتابة Kitaba", 140, 115);

  ctx.font = `500 220px ${display}`;
  ctx.fillText(String(Math.round(p.wpm)), 80, 400);
  const numWidth = ctx.measureText(String(Math.round(p.wpm))).width;
  ctx.fillStyle = "#c8962e";
  ctx.fillRect(84, 430, Math.max(160, numWidth), 6);

  ctx.fillStyle = "#9db0ab";
  ctx.font = `500 40px ${ui}`;
  ctx.fillText(p.wpmLabel, 100 + numWidth, 400);

  ctx.fillStyle = "#eef1ec";
  ctx.font = `500 44px ${ui}`;
  ctx.fillText(`${p.accuracyLabel}: ${p.accuracy.toFixed(1)}%`, 80, 520);
  ctx.fillStyle = "#9db0ab";
  ctx.font = `400 32px ${ui}`;
  ctx.fillText(p.mode, 80, 570);

  ctx.textAlign = "right";
  ctx.direction = p.lang === "ar" ? "rtl" : "ltr";
  ctx.fillText(p.caption, W - 80, 570);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("no-blob"))), "image/png"));
}

/** Creates the image client-side, then shares it (Web Share API) or downloads it. */
export function ShareResultButton({ wpm, accuracy, mode }: ShareResultProps) {
  const { t, lang } = useI18n();
  const [busy, setBusy] = useState(false);

  const share = async () => {
    setBusy(true);
    try {
      const blob = await renderResultImage({ wpm, accuracy, mode, lang, caption: t.share.caption, accuracyLabel: t.common.accuracy, wpmLabel: t.common.wpmShort });
      const file = new File([blob], `kitaba-${Math.round(wpm)}wpm.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Kitaba", text: t.share.caption });
      } else {
        downloadBlob(blob, file.name);
      }
    } catch {
      // Cancelled share sheets throw AbortError; nothing to report.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" size="lg" className="h-11 gap-2 px-5" onClick={() => void share()} disabled={busy} aria-busy={busy}>
      <Share2 className="size-4" aria-hidden="true" />
      {t.results.share}
    </Button>
  );
}
