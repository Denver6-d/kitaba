"use client";

import { useId } from "react";

interface Props {
  readonly values: readonly number[];
  readonly label: string;
  readonly height?: number;
  /** Optional reference line (e.g. average). */
  readonly reference?: number;
  readonly formatY?: (n: number) => string;
  readonly className?: string;
}

/**
 * Lightweight SVG line chart (no chart library). The SVG is labelled for
 * screen readers; a data table alternative is rendered visually hidden.
 */
export function LineChart({ values, label, height = 160, reference, formatY = (n) => String(Math.round(n)), className = "" }: Props) {
  const id = useId();
  const width = 600;
  const pad = { top: 12, right: 12, bottom: 20, left: 36 };
  if (values.length === 0) return null;
  const max = Math.max(10, ...values, reference ?? 0);
  const niceMax = Math.ceil(max / 10) * 10;
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const x = (i: number) => pad.left + (values.length === 1 ? innerW / 2 : (i / (values.length - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - (v / niceMax) * innerH;
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${pad.left},${pad.top + innerH} ${points} ${x(values.length - 1).toFixed(1)},${pad.top + innerH}`;
  const ticks = [0, niceMax / 2, niceMax];

  return (
    <figure className={className} dir="ltr">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-t`} className="h-auto w-full">
        <title id={`${id}-t`}>{label}</title>
        {ticks.map((tk) => (
          <g key={tk}>
            <line x1={pad.left} x2={width - pad.right} y1={y(tk)} y2={y(tk)} stroke="var(--rule)" strokeWidth={1} />
            <text x={pad.left - 8} y={y(tk) + 4} textAnchor="end" fontSize={11} fill="var(--ink-soft)" fontFamily="var(--font-ui)">
              {formatY(tk)}
            </text>
          </g>
        ))}
        {reference !== undefined && (
          <line
            x1={pad.left}
            x2={width - pad.right}
            y1={y(reference)}
            y2={y(reference)}
            stroke="var(--brass-fill)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
        )}
        {values.length > 1 && <polygon points={area} fill="var(--correct-wash)" />}
        <polyline points={points} fill="none" stroke="var(--correct)" strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />
        {values.length <= 40 &&
          values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={2.75} fill="var(--sheet)" stroke="var(--correct)" strokeWidth={1.5} />)}
      </svg>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {values.map((v, i) => (
            <tr key={i}>
              <th scope="row">{i + 1}</th>
              <td>{formatY(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
