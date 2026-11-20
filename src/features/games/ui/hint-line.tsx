import type { WordHint } from "@/domain/spelling/hint";

/**
 * The hint under a game word (DECISIONS M4): the word's Arabic hint, or the
 * fallback, its example sentence with the word hidden, plus the sentence's
 * Arabic translation when one exists. The fallback's Tatoeba credits are shown
 * with the feedback after the answer, as for every example (OD15).
 */
export function HintLine({ hint, label, blankLabel, uiLang, className = "" }: { hint: WordHint; label: string; blankLabel: string; uiLang: "ar" | "en"; className?: string }) {
  if (hint.kind === "ar") {
    return (
      <p className={`text-fg-2 ${className}`}>
        <span className="text-fg-3">{label}: </span>
        <span lang="ar" dir="rtl">{hint.text}</span>
      </p>
    );
  }
  return (
    <div className={`space-y-1 text-fg-2 ${className}`}>
      <p>
        <span className="text-fg-3">{label}: </span>
        <span dir="ltr" lang="en" className="inline-block">
          {hint.masked.split(/(_+)/).map((part, i) =>
            /^_+$/.test(part) ? (
              <span key={i}>
                <span aria-hidden="true">{part}</span>
                <span className="sr-only" lang={uiLang}>
                  {` ${blankLabel} `}
                </span>
              </span>
            ) : (
              part
            ),
          )}
        </span>
      </p>
      {hint.ar && (
        <p lang="ar" dir="rtl" className="text-sm">
          {hint.ar}
        </p>
      )}
    </div>
  );
}
