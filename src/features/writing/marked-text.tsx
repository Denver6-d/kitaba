"use client";

import type { Issue } from "@/domain/writing/check";
import { useI18n } from "@/i18n";

/**
 * The learner's text with every flagged word as a button: spelling mistakes
 * underlined in red with a wavy line, sound-alikes with a dashed line, notes
 * (an accepted British spelling) dotted. Never colour-only: each button's
 * accessible name says what it is.
 */
export function MarkedText({ text, issues, selected, onSelect }: { text: string; issues: readonly Issue[]; selected: number | null; onSelect: (i: number) => void }) {
  const { t } = useI18n();
  const parts: React.ReactNode[] = [];
  let at = 0;
  issues.forEach((issue, i) => {
    if (issue.start > at) parts.push(text.slice(at, issue.start));
    const style =
      issue.kind === "spelling"
        ? "text-error underline decoration-wavy decoration-2"
        : issue.kind === "confusable"
          ? "text-error underline decoration-dashed decoration-2"
          : "text-hint underline decoration-dotted decoration-2";
    parts.push(
      <button
        key={`${issue.start}-${i}`}
        type="button"
        onClick={() => onSelect(i)}
        aria-pressed={selected === i}
        aria-label={`${text.slice(issue.start, issue.end)}: ${t.writing.mark[issue.kind]}`}
        className={`inline rounded-sm px-0.5 underline-offset-4 ${style} ${selected === i ? "bg-brass-wash outline-2 outline-brass-fill" : "hover:bg-brass-wash"}`}
      >
        {text.slice(issue.start, issue.end)}
      </button>,
    );
    at = issue.end;
  });
  if (at < text.length) parts.push(text.slice(at));
  return (
    <div dir="ltr" lang="en" className="ruled rounded-xl border border-rule bg-paper p-4 font-mono text-lg leading-loose break-words whitespace-pre-wrap sm:text-xl">
      {parts}
    </div>
  );
}
