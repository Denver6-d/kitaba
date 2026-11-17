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
const PAD = 80;

/** Reads a next/font family name from its CSS variable so canvas text uses the same faces. */
function fontFamily(variable: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return v ? `${v}, ${fallback}` : fallback;
}

interface Texts {
  readonly lang: "ar" | "en";
  readonly wpm: string;
  readonly wpmLabel: string;
  readonly accuracyLine: string;
  readonly mode: string;
  readonly caption: string;
}

/** Draws the result card on a canvas (no library). */
async function renderResultImage(x: Texts): Promise<Blob> {
  const display = fontFamily("--font-literata", "Georgia, serif");
  const arabic = fontFamily("--font-cairo", "sans-serif");
  const ui = x.lang === "ar" ? arabic : fontFamily("--font-hanken", "system-ui, sans-serif");
  const fonts = [`500 220px ${display}`, `600 34px ${arabic}`, `500 44px ${ui}`, `400 30px ${ui}`];
  // fonts.ready alone does not load faces the page has not used yet.
  await Promise.all(fonts.map((f) => document.fonts.load(f, x.lang === "ar" ? "كتابة 0" : "Kitaba 0").catch(() => [])));

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no-canvas");
  const rtl = x.lang === "ar";
  const startX = rtl ? W - PAD : PAD;

  ctx.fillStyle = "#14302e";
  ctx.fillRect(0, 0, W, H);
  // Ruled baselines, the brand's signature.
  ctx.strokeStyle = "rgba(238, 241, 236, 0.07)";
  ctx.lineWidth = 1;
  for (let y = 90; y < H; y += 70) {
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(W - PAD, y);
    ctx.stroke();
  }

  // Logo: nib + wordmark, always top-left.
  ctx.direction = "ltr";
  ctx.textAlign = "left";
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
  ctx.font = fonts[1] ?? "";
  ctx.fillText("كتابة · Kitaba", 140, 115);

  // The number is always read left to right.
  ctx.font = fonts[0] ?? "";
  const numberWidth = ctx.measureText(x.wpm).width;
  const numberX = rtl ? W - PAD - numberWidth : PAD;
  ctx.fillText(x.wpm, numberX, 400);
  ctx.fillStyle = "#c8962e";
  ctx.fillRect(numberX + 4, 430, Math.max(160, numberWidth), 6);
  ctx.fillStyle = "#9db0ab";
  ctx.font = fonts[2] ?? "";
  ctx.direction = rtl ? "rtl" : "ltr";
  ctx.textAlign = rtl ? "right" : "left";
  ctx.fillText(x.wpmLabel, rtl ? numberX - 20 : numberX + numberWidth + 20, 400);

  // Text lines on the reading side, each with its own direction.
  ctx.fillStyle = "#eef1ec";
  ctx.fillText(x.accuracyLine, startX, 510);
  ctx.fillStyle = "#9db0ab";
  ctx.font = fonts[3] ?? "";
  ctx.fillText(x.mode, startX, 556);
  ctx.fillText(x.caption, startX, 598);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("no-blob"))), "image/png"));
}

/** Creates the image client-side, then shares it (Web Share API) or downloads it. */
export function ShareResultButton({ wpm, accuracy, mode }: ShareResultProps) {
  const { t, lang, num, pct } = useI18n();
  const [busy, setBusy] = useState(false);

  const share = async () => {
    setBusy(true);
    try {
      const blob = await renderResultImage({
        lang,
        wpm: num(Math.round(wpm)),
        wpmLabel: t.common.wpmShort,
        accuracyLine: `${t.common.accuracy}: ${pct(accuracy, 1)}`,
        mode,
        caption: t.share.caption,
      });
      const file = new File([blob], `kitaba-${Math.round(wpm)}wpm.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Kitaba", text: t.share.caption });
      } else {
        downloadBlob(blob, file.name);
      }
    } catch {
      // A cancelled share sheet throws AbortError; nothing to report.
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
