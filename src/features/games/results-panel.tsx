"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { motion } from "motion/react";
import type { PlayWord } from "@/data/play-word";
import { expectedSpelling } from "@/domain/spelling/check";
import { useI18n } from "@/i18n";
import { useReducedMotion } from "@/lib/use-hydrated";
import { useSettings } from "@/lib/settings-store";
import { giveFeedback } from "@/lib/feedback";
import type { SubmitStatus } from "@/repositories/types";
import { AnimatedNumber } from "@/components/animated-number";
import { Button } from "@/components/ui/button";
import { MomentLabel } from "@/components/ui/card";
import { nextStarGoal } from "@/domain/games/engine";
import type { FinishOutcome } from "./use-finish-game";

const STAR_PATH = "M12 2.8l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.8l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z";

/** When the first star pops in, and the gap between stars (seconds). Sounds and haptics follow the same beat. */
export const STAR_DELAY_S = 0.35;
export const STAR_STAGGER_S = 0.28;

/**
 * One star. Filled stars pop in one after another with a spring (DESIGN.md V3,
 * motion); under reduced motion they are simply there. On the mint result card
 * (`onMint`) the edge is the dark gold label colour, so a gold star keeps a
 * visible outline on the light background.
 */
export function Star({ filled, index, size = 40, animate = true, onMint = false }: { filled: boolean; index: number; size?: number; animate?: boolean; onMint?: boolean }) {
  const reduced = useReducedMotion();
  const still = reduced || !animate;
  const edge = onMint ? "var(--mint-label)" : "var(--gold)";
  const empty = onMint ? "color-mix(in srgb, var(--on-mint) 28%, transparent)" : "var(--line-strong)";
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="overflow-visible">
      <path d={STAR_PATH} fill="none" stroke={empty} strokeWidth="1.2" strokeLinejoin="round" />
      {filled &&
        (still ? (
          <path d={STAR_PATH} fill="var(--gold)" stroke={edge} strokeWidth="1.2" strokeLinejoin="round" />
        ) : (
          <motion.path
            d={STAR_PATH}
            fill="var(--gold)"
            stroke={edge}
            strokeWidth="1.2"
            strokeLinejoin="round"
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 14, mass: 0.8, delay: STAR_DELAY_S + index * STAR_STAGGER_S }}
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
  /** The words the session played (bank and library), for the review list. */
  readonly words: ReadonlyMap<string, PlayWord>;
  /** The stage or mode name, and "World 3 / Stage 2" for stages. */
  readonly title: string;
  readonly meta?: string | null;
}

/**
 * The stage result (DESIGN.md V3): a mint card with the stars, the stage name,
 * a heading, how to earn the next star and three stat tiles; then the words
 * that go to review as pills; then gold "Next stage" and outline "Replay".
 */
export function ResultsPanel({ outcome, saveFailed, boss, timed, onAgain, nextHref, isStage, words, title, meta = null }: Props) {
  const { t, num, pct } = useI18n();
  const [settings] = useSettings();
  const [board, setBoard] = useState<SubmitStatus | null>(null);
  const reviewId = useId();

  useEffect(() => {
    if (!outcome) return;
    let alive = true;
    void outcome.leaderboard.then((s) => {
      if (alive) setBoard(s);
    });
    // One sound and buzz per star, in time with each star popping in (STAR_DELAY_S).
    // Free play and review have no stars: one "cleared" sound and no buzz instead.
    if (outcome.stars === null) giveFeedback("cleared", settings);
    const timers = Array.from({ length: outcome.stars ?? 0 }, (_, i) => window.setTimeout(() => giveFeedback("star", settings, i), (STAR_DELAY_S + i * STAR_STAGGER_S) * 1000));
    return () => {
      alive = false;
      timers.forEach((id) => window.clearTimeout(id));
    };
    // Once per outcome.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome]);

  if (!outcome) {
    return (
      <div className="mx-auto max-w-2xl rounded-card border border-line p-8" role="status">
        {saveFailed ? <p className="text-error">{t.game.saveFailed}</p> : <p className="text-fg-2">{t.common.loading}</p>}
      </div>
    );
  }

  const { summary, stars } = outcome;
  const cleared = stars === null || stars > 0;
  const improved = stars !== null && outcome.previous !== null && outcome.best !== null && outcome.best.updatedAt !== outcome.previous.updatedAt;
  const missed = summary.missed.flatMap((id) => words.get(id) ?? []);
  // The next star counts from the stage's best, not this round: a learner with three stars is not told to earn a second.
  const goal = stars === null ? null : nextStarGoal(Math.max(stars, outcome.best?.stars ?? 0), { boss, timed });

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <section className="moment space-y-6 p-6 text-center sm:p-10">
        {stars !== null && (
          <div className="flex items-end justify-center gap-3" aria-label={t.play.stars(stars)} role="img">
            {[0, 1, 2].map((i) => (
              <Star key={i} index={i} filled={i < stars} size={i === 1 ? 60 : 46} onMint />
            ))}
          </div>
        )}
        {/* Only the words are a live region: the counting numbers below would be read frame by frame. */}
        <div className="space-y-2" role="status" aria-live="polite">
          <MomentLabel>{meta ? `${title} / ${meta}` : title}</MomentLabel>
          <h2 className="text-[clamp(1.75rem,6vw,2.5rem)] leading-tight font-light text-on-mint">
            {stars === null ? t.game.resultTitle : cleared ? t.game.cleared : t.game.notCleared}
          </h2>
          {stars !== null && (
            <p className="text-on-mint-2">{goal ? t.game.nextStar(goal.star, goal.percent, goal.kind === "words" ? goal.words : null) : t.game.allStars}</p>
          )}
          {improved && <p className="font-medium text-on-mint">{t.game.newBest}</p>}
        </div>
        <dl className="grid grid-cols-3 gap-2 sm:gap-3">
          <Tile label={t.game.accuracy}>
            <AnimatedNumber value={Math.round(summary.accuracy * 100)} format={(n) => pct(Math.round(n))} />
          </Tile>
          <Tile label={t.game.xp}>
            <AnimatedNumber value={outcome.xp} format={(n) => `+${num(Math.round(n))}`} />
          </Tile>
          <Tile label={t.progress.streak}>
            <AnimatedNumber value={outcome.streak} format={(n) => num(Math.round(n))} />
          </Tile>
        </dl>
      </section>

      <section aria-labelledby={reviewId} className="space-y-4">
        <h3 id={reviewId} className="text-lg font-medium">
          {t.game.missedWords}
        </h3>
        {missed.length === 0 ? (
          <p className="text-fg-2">{t.game.allCorrect}</p>
        ) : (
          <ul className="flex flex-wrap gap-2" dir="ltr" lang="en">
            {missed.map((w) => (
              <li key={w.id} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line-strong/60 px-4 font-word text-lg">
                {expectedSpelling(w, settings.accent)}
                {w.ar && (
                  <span className="font-sans text-sm text-fg-2" lang="ar" dir="rtl">
                    {w.ar}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {(outcome.levelUp !== null || board || saveFailed) && (
        <div className="space-y-2 text-sm">
          {outcome.levelUp !== null && <p className="text-fg">{t.game.levelUp(outcome.levelUp)}</p>}
          {saveFailed && <p className="rounded-2xl border border-error/50 p-3 text-error">{t.game.saveFailed}</p>}
          {board && <p className="text-fg-2">{board === "ok" ? t.game.submitted : (t.leaderboard.rejected[board] ?? "")}</p>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {cleared && nextHref ? (
          <Button variant="primary" asChild size="lg" className="flex-1 sm:flex-none sm:min-w-48">
            <Link href={nextHref}>{t.game.nextStage}</Link>
          </Button>
        ) : null}
        <Button size="lg" variant={cleared && nextHref ? "outline" : "primary"} onClick={onAgain} className="flex-1 sm:flex-none">
          {isStage ? t.game.replay : t.game.playAgain}
        </Button>
        <Button asChild variant="link">
          <Link href="/play">{t.game.backToMap}</Link>
        </Button>
      </div>
    </div>
  );
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-on-mint/15 px-2 py-4 sm:px-4">
      <dt className="text-xs text-on-mint-2 sm:text-sm">{label}</dt>
      <dd dir="ltr" className="mt-1 font-latin text-[clamp(1.35rem,5vw,2rem)] leading-none font-light text-on-mint tabular">{children}</dd>
    </div>
  );
}
