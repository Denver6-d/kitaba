"use client";

import { useId, useState } from "react";
import { CUSTOM_TEXT_MAX, sanitizeCustomText } from "@/domain/typing/text";
import { useI18n } from "@/i18n";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { UntimedPractice } from "@/features/typing/untimed-practice";

export default function CustomTextPage() {
  const { t } = useI18n();
  const [raw, setRaw] = useState("");
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const id = useId();

  const check = sanitizeCustomText(raw);

  const start = () => {
    if (check.text === "") return setError(t.custom.empty);
    if (check.tooLong) return setError(t.custom.tooLong(CUSTOM_TEXT_MAX));
    setError(null);
    setText(check.text);
  };

  if (text !== null) {
    return (
      <Page title={t.custom.title}>
        <UntimedPractice key={round} text={text} source="custom" modeLabel={t.test.sources.custom} onAgain={() => setRound((r) => r + 1)} />
        <button type="button" onClick={() => setText(null)} className="mt-6 text-sm text-ink-soft underline underline-offset-4">
          {t.common.back}
        </button>
      </Page>
    );
  }

  return (
    <Page title={t.custom.title} intro={t.learn.customIntro} width="narrow">
      <div className="space-y-3">
        <label htmlFor={id} className="block font-medium">
          {t.custom.label}
        </label>
        <textarea
          id={id}
          value={raw}
          onChange={(e) => setRaw(e.target.value.slice(0, CUSTOM_TEXT_MAX * 2))}
          dir="ltr"
          lang="en"
          rows={8}
          placeholder={t.custom.placeholder}
          aria-invalid={error !== null}
          aria-describedby={`${id}-help ${id}-err`}
          className="w-full rounded-xl border border-input bg-sheet p-4 font-mono text-base leading-relaxed shadow-sheet focus:border-brass-fill"
        />
        <div id={`${id}-help`} className="flex flex-wrap justify-between gap-2 text-sm text-ink-soft">
          <span className={check.tooLong ? "text-error" : ""}>{t.custom.counter(check.text.length, CUSTOM_TEXT_MAX)}</span>
          {check.stripped && <span>{t.custom.stripped}</span>}
        </div>
        <p id={`${id}-err`} role="alert" className="min-h-5 text-sm text-error">
          {error}
        </p>
        <Button onClick={start} size="lg" className="h-11 px-6">
          {t.custom.start}
        </Button>
      </div>
    </Page>
  );
}
