"use client";

import type { DiffToken } from "@/domain/sentences/grader";
import { useI18n } from "@/i18n";

/**
 * Word-level diff. Missing words are inserted (underlined), extra words are
 * deleted (struck through), replaced words show both. Semantic <ins>/<del>
 * plus visually hidden labels, so the meaning never relies on colour alone.
 */
export function DiffView({ diff }: { diff: readonly DiffToken[] }) {
  const { lang } = useI18n();
  const sr = lang === "ar" ? { added: "ناقصة:", removed: "زائدة:" } : { added: "missing:", removed: "extra:" };
  return (
    <p dir="ltr" lang="en" className="flex flex-wrap gap-x-2 gap-y-1.5 font-mono text-lg leading-relaxed">
      {diff.map((tok, i) => {
        switch (tok.kind) {
          case "equal":
            return <span key={i}>{tok.text}</span>;
          case "missing":
            return (
              <ins key={i} className="rounded bg-[var(--correct-wash)] px-1 text-correct no-underline decoration-2 underline-offset-4 [text-decoration-line:underline]">
                <span className="sr-only">{sr.added} </span>
                {tok.text}
              </ins>
            );
          case "extra":
            return (
              <del key={i} className="rounded bg-[var(--error-wash)] px-1 text-error decoration-2">
                <span className="sr-only">{sr.removed} </span>
                {tok.text}
              </del>
            );
          case "replaced":
            return (
              <span key={i} className="inline-flex gap-1">
                <del className="rounded bg-[var(--error-wash)] px-1 text-error decoration-2">
                  <span className="sr-only">{sr.removed} </span>
                  {tok.text}
                </del>
                <ins className="rounded bg-[var(--correct-wash)] px-1 text-correct decoration-2 underline-offset-4 [text-decoration-line:underline]">
                  <span className="sr-only">{sr.added} </span>
                  {tok.expected}
                </ins>
              </span>
            );
        }
      })}
    </p>
  );
}
