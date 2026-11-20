"use client";

import { useId } from "react";

interface Option<V extends string | number> {
  readonly value: V;
  readonly label: string;
}

/** Accessible segmented control built on native radio inputs (arrow keys work for free). */
export function Segmented<V extends string | number>({
  legend,
  options,
  value,
  onChange,
  hideLegend = false,
  activeTone = "neutral",
}: {
  legend: string;
  options: readonly Option<V>[];
  value: V;
  onChange: (v: V) => void;
  hideLegend?: boolean;
  /** "gold" for the active level chip, one of the few places gold is allowed (DESIGN.md V3). */
  activeTone?: "neutral" | "gold";
}) {
  const name = useId();
  return (
    <fieldset className="min-w-0">
      <legend className={hideLegend ? "sr-only" : "mb-2 text-sm text-fg-2"}>{legend}</legend>
      <div className="flex max-w-full flex-wrap gap-2">
        {options.map((o) => {
          const checked = o.value === value;
          return (
            <label
              key={String(o.value)}
              className={`relative inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gold ${
                checked
                  ? activeTone === "gold"
                    ? "border-gold bg-gold font-medium text-on-gold"
                    : "border-fg-2 bg-raised font-medium text-fg"
                  : "border-line text-fg-2 hover:border-line-strong hover:text-fg"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={String(o.value)}
                checked={checked}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
