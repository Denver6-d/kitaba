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
}: {
  legend: string;
  options: readonly Option<V>[];
  value: V;
  onChange: (v: V) => void;
  hideLegend?: boolean;
}) {
  const name = useId();
  return (
    <fieldset className="min-w-0">
      <legend className={hideLegend ? "sr-only" : "mb-1.5 text-xs text-ink-soft"}>{legend}</legend>
      <div className="inline-flex flex-wrap rounded-lg border border-rule bg-sheet p-1">
        {options.map((o) => {
          const checked = o.value === value;
          return (
            <label
              key={String(o.value)}
              className={`relative cursor-pointer rounded-md px-3.5 py-1.5 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brass-fill ${
                checked ? "bg-ink font-medium text-paper" : "text-ink-soft hover:text-ink"
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
