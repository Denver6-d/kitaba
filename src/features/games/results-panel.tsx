"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import type { PlayWord } from "@/data/play-word";
import { expectedSpelling } from "@/domain/spelling/check";
import { useI18n } from "@/i18n";
import { useReducedMotion } from "@/lib/use-hydrated";
import { useSettings } from "@/lib/settings-store";
import { playTone } from "@/lib/sound";
import type { SubmitStatus } from "@/repositories/types";
import { AnimatedNumber } from "@/components/animated-number";
import { Button } from "@/components/ui/button";
import type { FinishOutcome } from "./use-finish-game";

const STAR_PATH = "M12 2.8l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.8l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z";

/** One star; filled stars draw their outline then fill (300 ms each, staggered). */
export function Star({ filled, index, size = 40, animate = true }: { filled: boolean; index: number; size?: number; animate?: boolean }) {
  const reduced = useReducedMotion();
  const still = reduced || !animate;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="overflow-visible">
      <path d={STAR_PATH} fill="none" stroke="var(--rule-strong)" strokeWidth="1.2" strokeLinejoin="round" />
      {filled &&
        (still ? (
          <path d={STAR_PATH} fill="var(--brass-fill)" stroke="var(--brass-fill)" strokeWidth="1.2" strokeLinejoin="round" />
        ) : (
          <motion.path
            d={STAR_PATH}
            stroke="var(--brass-fill)"
            strokeWidth="1.2"
            strokeLinejoin="round"
            initial={{ pathLength: 0, fill: "rgba(200,150,46,0)" }}
            animate={{ pathLength: 1, fill: "var(--brass-fill)" }}
            transition={{ delay: 0.25 + index * 0.3, duration: 0.3, ease: "easeOut" }}
          />
        ))}
    </svg>
  );
}

interface Props {
  readonly outcome: FinishOutcome | null;
  readonly saveFailed: boolean;
  readonly boss: boolean;
  readonly timed: boolean;
  readonly onAgain: () => void;
  /** Next campaign stage, when there is one and this stage was cleared. */
  readonly nextHref: string | null;
  readonly isStage: boolean;
  /** The words the session played (bank and library), for the missed-words list. */
  readonly words: ReadonlyMap<string, PlayWord>;
}

export function ResultsPanel({ outcome, saveFailed, boss, timed, onAgain, nextHref, isStage, words }: Props) {
  const { t, num, pct } = useI18n();
  const [settings] = useSettings();
  const [board, setBoard] = useState<SubmitStatus | null>(null);

  useEffect(() => {
    if (!outcome) return;
    let alive = true;
    void outcome.leaderboard.then((s) => {
      if (alive) setBoard(s);
    });
    if (settings.sounds && (outcome.stars ?? 1) > 0) playTone("cleared");
    return () => {
      alive = false;
    };
    // Once per outcome.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome]);

  if (!outcome) {
    return (
      <div className="sheet p-8" role="status">
        {saveFailed ? <p className="text-error">{t.game.saveFailed}</p> : <p className="text-ink-soft">{t.common.loading}</p>}
      </div>
    );
  }

  const { summary, stars } = outcome;
  const cleared = stars === null || stars > 0;
  const improved = stars !== null && outcome.previous !== null && outcome.best !== null && outcome.best.updatedAt !== outcome.previous.updatedAt;
  const missed = summary.missed.flatMap((id) => words.get(id) ?? []);

  return (
    <div className="sheet space-y-8 p-6 sm:p-10" role="status" aria-live="polite">
      <div className="space-y-4 text-center">
        <h2 className="text-2xl font-bold sm:text-3xl">{stars === null ? t.game.resultTitle : cleared ? t.game.cleared : t.game.notCleared}</h2>
        {stars !== null && (
          <div className="flex items-end justify-center gap-3" aria-label={t.play.stars(stars)} role="img">
            {[0, 1, 2].map((i) => (
              <Star key={i} index={i} filled={i < stars} size={i === 1 ? 56 : 44} />
            ))}
          </div>
        )}
        {!cleared && <p className="text-ink-soft">{timed ? t.game.needWords(10) : t.game.needStars(boss ? 70 : 60)}</p>}
        {improved && <p className="font-medium text-brass">{t.game.newBest}</p>}
      </div>

      <dl className="grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
        <Stat label={t.game.score}>
          <AnimatedNumber value={summary.points} format={(n) => num(Math.round(n))} />
        </Stat>
        <Stat label={t.game.accuracy}>{pct(Math.round(summary.accuracy * 100))}</Stat>
        <Stat label={t.progress.wordsCorrect}>
          {num(summary.correct)} / {num(summary.answered)}
        </Stat>
        <Stat label={t.game.bestCombo}>{num(summary.maxCombo)}</Stat>
      </dl>

      <p className="text-center text-brass">
        {t.game.xpGained(outcome.xp)}
        {outcome.levelUp !== null && <span className="ms-2 font-semibold">· {t.game.levelUp(outcome.levelUp)}</span>}
      </p>

      <section className="space-y-3">
        <h3 className="font-semibold">{t.game.missedWords}</h3>
        {missed.length === 0 ? (
          <p className="text-ink-soft">{t.game.allCorrect}</p>
        ) : (
          <ul className="flex flex-wrap gap-2" dir="ltr" lang="en">
            {missed.map((w) => (
              <li key={w.id} className="rounded-full border border-rule px-3 py-1.5 font-mono">
                {expectedSpelling(w, settings.accent)}
                {w.ar && (
                  <span className="font-sans text-sm text-hint" lang="ar" dir="rtl">
                    {" "}
                    · {w.ar}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {saveFailed && <p className="rounded-lg bg-[var(--error-wash)] p-3 text-sm text-error">{t.game.saveFailed}</p>}
      {board && <p className="text-sm text-ink-soft">{board === "ok" ? t.game.submitted : (t.leaderboard.rejected[board] ?? "")}</p>}

      <div className="flex flex-wrap gap-3">
        {cleared && nextHref ? (
          <Button asChild size="lg" className="h-12 flex-1 px-6 text-base sm:flex-none">
            <Link href={nextHref}>{t.game.nextStage}</Link>
          </Button>
        ) : null}
        <Button size="lg" variant={cleared && nextHref ? "outline" : "default"} onClick={onAgain} className="h-12 flex-1 px-6 text-base sm:flex-none">
          {isStage ? t.game.tryAgain : t.game.playAgain}
        </Button>
        <Button asChild size="lg" variant="ghost" className="h-12">
          <Link href="/play">{t.game.backToMap}</Link>
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-rule p-4">
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd className="mt-1 font-latin-display text-3xl font-medium tabular">{children}</dd>
    </div>
  );
}
