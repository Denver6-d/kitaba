import type { DiffSegment } from "@/domain/spelling/diff";

/**
 * The learner's answer against the expected spelling: missing letters are
 * inserted and underlined, extra letters struck, wrong letters struck with the
 * right ones beside them. Never colour-only (underline / strike + sr text).
 */
export function LetterDiff({ segments, labels }: { segments: readonly DiffSegment[]; labels: { missing: string; extra: string; wrong: string } }) {
  return (
    <span dir="ltr" lang="en" className="font-mono text-xl tracking-wide">
      {segments.map((s, i) => {
        switch (s.kind) {
          case "same":
            return <span key={i}>{s.text}</span>;
          case "missing":
            return (
              <ins key={i} className="rounded bg-[var(--correct-wash)] px-0.5 text-correct underline decoration-2 underline-offset-4">
                <span className="sr-only">({labels.missing}) </span>
                {s.text}
              </ins>
            );
          case "extra":
            return (
              <del key={i} className="rounded bg-[var(--error-wash)] px-0.5 text-error decoration-2">
                <span className="sr-only">({labels.extra}) </span>
                {s.text}
              </del>
            );
          case "wrong":
            return (
              <span key={i} className="inline-flex items-baseline">
                <del className="rounded-s bg-[var(--error-wash)] px-0.5 text-error decoration-2">
                  <span className="sr-only">({labels.wrong}) </span>
                  {s.text}
                </del>
                <ins className="rounded-e bg-[var(--correct-wash)] px-0.5 text-correct underline decoration-2 underline-offset-4">{s.expected}</ins>
              </span>
            );
        }
      })}
    </span>
  );
}
