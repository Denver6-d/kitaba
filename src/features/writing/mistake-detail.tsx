"use client";

import { useState } from "react";
import { BookPlus, Volume2 } from "lucide-react";
import { spellingWordById } from "@/data/words";
import type { MistakeType } from "@/domain/writing/classify";
import { useI18n } from "@/i18n";
import { useSpeech } from "@/lib/speech";
import { useRepos } from "@/repositories/provider";
import { Button } from "@/components/ui/button";
import { LetterDiff } from "@/features/games/letter-diff";
import { letterDiff } from "@/domain/spelling/diff";
import { bankIdBySpelling } from "./bank";

export interface MistakeView {
  readonly word: string;
  readonly suggestion: string | null;
  readonly type: MistakeType;
  readonly kind: "spelling" | "confusable" | "note";
  readonly pair?: string | undefined;
  /** The sentence the word was in (used as the example when the bank has none). */
  readonly context?: string | undefined;
}

/**
 * The panel under the text for the word the learner tapped: the right
 * spelling with the letters that differ, the rule in one line, a listen
 * button, an example, and "add to my dictionary" for names and real words.
 */
export function MistakeDetail({ m, onAdded, accent }: { m: MistakeView; onAdded?: (word: string) => void; accent: "us" | "uk" }) {
  const { t } = useI18n();
  const { speak, status } = useSpeech();
  const repos = useRepos();
  const [added, setAdded] = useState(false);
  const right = m.suggestion;
  const bank = right ? spellingWordById.get(bankIdBySpelling.get(right.toLowerCase()) ?? "") : undefined;
  const example = bank?.example ?? (m.context && right ? m.context : null);
  const explanation = m.kind === "note" ? null : m.pair ? (t.writing.pairs[m.pair] ?? t.writing.types[m.type]) : t.writing.types[m.type];
  const noteText = m.kind === "note" && right ? (accent === "us" ? t.writing.noteBritish(right) : t.writing.noteAmerican(right)) : null;

  return (
    <div className="space-y-3 rounded-xl border border-rule bg-paper p-4" aria-live="polite">
      <p className="text-sm text-ink-soft">{t.writing.mark[m.kind]}</p>
      {right ? (
        <div className="space-y-2">
          <p className="flex flex-wrap items-baseline gap-3" dir="ltr" lang="en">
            <span className="font-mono text-xl text-error line-through decoration-2">{m.word}</span>
            <span aria-hidden="true">→</span>
            <span className="font-mono text-2xl font-semibold text-correct">{right}</span>
          </p>
          {m.kind === "spelling" && m.type !== "capital" && (
            <div className="font-mono text-lg">
              <span className="sr-only">{t.writing.correct}: </span>
              <LetterDiff segments={letterDiff(m.word.toLowerCase(), right.toLowerCase())} labels={{ missing: "+", extra: "−", wrong: "≠" }} />
            </div>
          )}
        </div>
      ) : (
        <p className="font-mono text-xl text-error" dir="ltr" lang="en">
          {m.word}
        </p>
      )}
      {noteText && <p className="text-hint">{noteText}</p>}
      {explanation && <p className="text-hint">{right ? explanation : t.writing.noSuggestion}</p>}
      {!right && !explanation && <p className="text-hint">{t.writing.noSuggestion}</p>}
      {example && (
        <p className="text-ink-soft">
          <span className="font-medium">{t.writing.example}: </span>
          <span dir="ltr" lang="en">
            {example}
          </span>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {right && status === "ready" && (
          <Button type="button" variant="outline" className="h-11 gap-2" onClick={() => speak(example ? `${right}. ${example}` : right, 0.85)}>
            <Volume2 className="size-4" aria-hidden="true" />
            {t.writing.listen}
          </Button>
        )}
        {m.kind === "spelling" && m.type !== "capital" && onAdded && !added && (
          <Button
            type="button"
            variant="ghost"
            className="h-11 gap-2"
            onClick={() => {
              void repos.dictionary.add(m.word).then(() => {
                setAdded(true);
                onAdded(m.word);
              });
            }}
          >
            <BookPlus className="size-4" aria-hidden="true" />
            {t.writing.addToDictionary}
          </Button>
        )}
      </div>
      {added && <p className="text-sm text-correct">{t.writing.added}</p>}
    </div>
  );
}
