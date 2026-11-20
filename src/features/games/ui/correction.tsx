"use client";

import type { MouseEvent } from "react";
import { Check } from "lucide-react";
import type { DiffSegment } from "@/domain/spelling/diff";
import { correctionRuns } from "@/domain/spelling/correction";
import { AudioButton } from "./audio-button";

/**
 * What the learner wrote, with the mistakes marked on their own letters
 * (DESIGN.md V3): extra and wrong letters are struck through in the error
 * colour; a missing letter is a small error caret with a wavy underline.
 * Every mark carries screen-reader text, so nothing relies on colour alone.
 */
export function AnswerMarks({ segments, labels }: { segments: readonly DiffSegment[]; labels: { missing: string; extra: string; wrong: string } }) {
  return (
    <span dir="ltr" lang="en" className="font-word text-[clamp(1.25rem,4.5vw,1.6rem)] tracking-wide break-all">
      {segments.map((s, i) => {
        switch (s.kind) {
          case "same":
            return <span key={i}>{s.text}</span>;
          case "missing":
            return (
              <span key={i} className="mx-px inline-block text-error underline decoration-wavy decoration-error underline-offset-[6px]">
                <span className="sr-only">({labels.missing}: {s.text}) </span>
                <span aria-hidden="true">‸</span>
              </span>
            );
          case "extra":
          case "wrong":
            return (
              <del key={i} className="text-error decoration-error decoration-2">
                <span className="sr-only">({s.kind === "extra" ? labels.extra : labels.wrong}) </span>
                {s.text}
              </del>
            );
        }
      })}
    </span>
  );
}

/** The correct spelling, large, with the letters that were wrong or missing in gold (and underlined). */
export function CorrectSpelling({ segments, word, keyLabel }: { segments: readonly DiffSegment[] | null; word: string; keyLabel: string }) {
  const runs = segments ? correctionRuns(segments, word) : [{ text: word, key: false }];
  return (
    <strong dir="ltr" lang="en" className="block font-word text-[clamp(2rem,9vw,3.25rem)] leading-[1.1] font-normal break-words">
      {runs.map((r, i) =>
        r.key ? (
          <span key={i} className="text-gold underline decoration-gold/60 decoration-2 underline-offset-[0.18em]">
            <span className="sr-only">({keyLabel}) </span>
            {r.text}
          </span>
        ) : (
          <span key={i}>{r.text}</span>
        ),
      )}
    </strong>
  );
}

/** The "correct spelling" block of a wrong answer: label, the word with key letters, and a small audio button. */
export function CorrectionHeader({
  label,
  segments,
  word,
  keyLabel,
  listenLabel,
  onListen,
  onMouseDown,
}: {
  label: string;
  segments: readonly DiffSegment[] | null;
  word: string;
  keyLabel: string;
  listenLabel: string;
  onListen: (() => void) | null;
  onMouseDown?: ((e: MouseEvent) => void) | undefined;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-fg-2">{label}</p>
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <CorrectSpelling segments={segments} word={word} keyLabel={keyLabel} />
        </div>
        {onListen && <AudioButton size="sm" label={listenLabel} onPlay={onListen} ringing={false} onMouseDown={onMouseDown} />}
      </div>
    </div>
  );
}

/** A right answer: a check and one line, nothing louder. */
export function CorrectLine({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-2 text-lg text-fg">
      <span className="grid size-7 place-items-center rounded-full border border-fg">
        <Check className="size-4" strokeWidth={2} aria-hidden="true" />
      </span>
      {text}
    </p>
  );
}
