"use client";

import { memo } from "react";
import { errorRate, type KeyStats } from "@/domain/typing/key-stats";
import { KEY_GAP, KEY_UNIT, KEYBOARD_HEIGHT, KEYBOARD_WIDTH, KEYS } from "./geometry";

interface Props {
  /** Heatmap mode: colour keys by error rate. */
  readonly stats?: KeyStats;
  /** Guide mode: highlight the next key (and Shift). */
  readonly nextKey?: string | null;
  readonly shift?: boolean;
  readonly label: string;
  readonly showArabic?: boolean;
  readonly className?: string;
}

/** Interpolates from the sheet colour to the error colour (heat 0–1) with CSS color-mix. */
const heatFill = (heat: number) => `color-mix(in oklab, var(--error) ${Math.round(8 + heat * 72)}%, var(--key))`;

/**
 * QWERTY keyboard drawn in SVG. Always laid out left-to-right (it is a physical
 * object), so it sits in a dir="ltr" wrapper even inside the RTL UI.
 */
export const KeyboardSvg = memo(function KeyboardSvg({ stats, nextKey, shift = false, label, showArabic = true, className = "" }: Props) {
  return (
    <div dir="ltr" className={className}>
      <svg viewBox={`0 0 ${KEYBOARD_WIDTH} ${KEYBOARD_HEIGHT}`} role="img" aria-label={label} className="h-auto w-full select-none">
        {KEYS.map((k) => {
          const s = stats?.[k.id];
          const attempts = s ? s.hits + s.misses : 0;
          const heat = s && attempts >= 3 ? Math.min(1, errorRate(s) * 4) : 0;
          const isNext = nextKey !== undefined && nextKey !== null && k.id === nextKey;
          const isShift = shift && (k.id === "shift-left" || k.id === "shift-right");
          const fill = stats ? (attempts >= 3 ? heatFill(heat) : "var(--key)") : isNext || isShift ? "var(--brass-wash)" : "var(--key)";
          const stroke = isNext || isShift ? "var(--brass-fill)" : "var(--key-edge)";
          const w = k.width * KEY_UNIT - KEY_GAP;
          const h = KEY_UNIT - KEY_GAP;
          const isChar = k.id.length === 1 && k.id !== " ";
          return (
            <g key={k.id} transform={`translate(${k.x + KEY_GAP / 2} ${k.y + KEY_GAP / 2})`}>
              <rect width={w} height={h} rx={6} fill={fill} stroke={stroke} strokeWidth={isNext || isShift ? 2 : 1} />
              <text
                x={isChar ? 8 : w / 2}
                y={isChar ? 15 : h / 2 + 4}
                textAnchor={isChar ? "start" : "middle"}
                fontSize={isChar ? 12 : 10}
                fill={heat > 0.6 ? "var(--sheet)" : "var(--ink)"}
                fontFamily="var(--font-ui)"
                fontWeight={500}
              >
                {k.label}
              </text>
              {showArabic && k.arabic && (
                <text x={w - 7} y={h - 7} textAnchor="end" fontSize={11} fill={heat > 0.6 ? "var(--sheet)" : "var(--hint)"} fontFamily="var(--font-arabic)">
                  {k.arabic}
                </text>
              )}
              {(k.id === "f" || k.id === "j") && <rect x={w / 2 - 5} y={h - 6} width={10} height={2} rx={1} fill="var(--ink-soft)" />}
            </g>
          );
        })}
      </svg>
    </div>
  );
});
