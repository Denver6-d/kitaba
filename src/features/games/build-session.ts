"use client";

import { spellingWordById, spellingWords } from "@/data/words";
import type { SpellingWord } from "@/data/schema";
import { DAILY_MODES, dailyId, seedFrom, stageDef } from "@/domain/games/campaign";
import type { GameConfig, GameItem, ItemMode } from "@/domain/games/engine";
import { drawFromBag, returnToBag, type BagState } from "@/domain/games/shuffle-bag";
import { buildItems } from "@/domain/games/session";
import type { CefrLevel, GameMode } from "@/domain/model";
import { LEVELS } from "@/domain/model";
import { dayKey } from "@/domain/progress/streak";
import { seededRng, shuffle, type Rng } from "@/domain/shared/random";
import type { Accent } from "@/domain/spelling/check";
import type { OutboxStore } from "@/repositories/local/outbox";
import type { Repositories } from "@/repositories/types";

/** What the learner asked to play. */
export type GameRequest =
  | { readonly kind: "stage"; readonly id: string }
  | { readonly kind: "daily" }
  | { readonly kind: "free"; readonly mode: Exclude<GameMode, "review" | "mixed">; readonly level: CefrLevel | null; readonly category: string | null }
  | { readonly kind: "review" };

export interface BuiltSession {
  readonly items: GameItem[];
  readonly config: GameConfig;
  /** Stage id for stage and daily games; null for free play and review. */
  readonly stageId: string | null;
  readonly mode: GameMode;
  readonly boss: boolean;
}

const UNTIMED: GameConfig = { durationMs: null, speedBonus: false };
const BEE: GameConfig = { durationMs: 60_000, speedBonus: true };
/** Enough words for a fast 60-second Spelling Bee. */
const BEE_WORDS = 40;
const FREE_ITEMS = 10;
const REVIEW_MAX = 15;
/** Spare words so a word that cannot make an item in a mode can be skipped. */
const SPARE = 6;

const bankSpellings: ReadonlySet<string> = new Set(spellingWords.flatMap((w) => (w.uk ? [w.word, w.uk] : [w.word])));

const BAG_PREFIX = "bag:";

/**
 * Draws from a persisted shuffle-bag (local only, never synced), builds the
 * items, and returns the words that were not used to the bag, so words do not
 * repeat until the pool is used up.
 */
async function drawAndBuild(
  meta: OutboxStore,
  key: string,
  pool: readonly SpellingWord[],
  n: number,
  rng: Rng,
  build: (words: SpellingWord[]) => GameItem[],
): Promise<GameItem[]> {
  const state = (await meta.getMeta<BagState>(BAG_PREFIX + key).catch(() => undefined)) ?? null;
  const { ids, state: next } = drawFromBag(
    pool.map((w) => w.id),
    state,
    n,
    rng,
  );
  const items = build(ids.flatMap((id) => spellingWordById.get(id) ?? []));
  const used = new Set(items.map((i) => i.wordId));
  await meta.setMeta(BAG_PREFIX + key, returnToBag(next, ids.filter((id) => !used.has(id)))).catch(() => undefined);
  return items;
}

export const levelsUpTo = (level: CefrLevel | null): readonly CefrLevel[] =>
  level === null ? LEVELS : LEVELS.slice(0, Math.min(LEVELS.length, LEVELS.indexOf(level) + 2));

export async function buildSession(
  req: GameRequest,
  deps: { readonly repos: Repositories; readonly meta: OutboxStore; readonly accent: Accent; readonly rng: Rng; readonly now: number },
): Promise<BuiltSession> {
  const ctx = { accent: deps.accent, rng: deps.rng, bankSpellings };
  switch (req.kind) {
    case "stage": {
      const def = stageDef(req.id);
      if (!def) return { items: [], config: UNTIMED, stageId: req.id, mode: "listen", boss: false };
      const pool = spellingWords.filter((w) => def.world.categories.includes(w.category) && def.levels.includes(w.level));
      const count = def.timed ? BEE_WORDS : def.items;
      const items = await drawAndBuild(deps.meta, `stage:${def.id}`, pool, count + SPARE, deps.rng, (words) => buildItems(def.modes, words, ctx, count));
      const mode: GameMode = Array.isArray(def.modes) ? "mixed" : (def.modes as GameMode);
      return { items, config: def.timed ? BEE : UNTIMED, stageId: def.id, mode, boss: def.boss };
    }
    case "daily": {
      // Everyone gets the same words on the same day for a given level choice.
      const day = dayKey(new Date(deps.now));
      const profile = await deps.repos.profile.get();
      const levels = levelsUpTo(profile.level);
      const rng = seededRng(seedFrom(`${day}:${levels.join("")}`));
      const pool = spellingWords.filter((w) => levels.includes(w.level));
      const words = shuffle(pool, rng).slice(0, DAILY_MODES.length + SPARE);
      return { items: buildItems(DAILY_MODES, words, { ...ctx, rng }, DAILY_MODES.length), config: UNTIMED, stageId: dailyId(day), mode: "mixed", boss: false };
    }
    case "free": {
      const pool = spellingWords.filter((w) => (req.level === null || w.level === req.level) && (req.category === null || w.category === req.category));
      const timed = req.mode === "bee";
      const count = timed ? BEE_WORDS : FREE_ITEMS;
      const key = `free:${req.level ?? "all"}:${req.category ?? "all"}`;
      const items = await drawAndBuild(deps.meta, key, pool, count + SPARE, deps.rng, (words) => buildItems(req.mode as ItemMode, words, ctx, count));
      return { items, config: timed ? BEE : UNTIMED, stageId: null, mode: req.mode, boss: false };
    }
    case "review": {
      const due = await deps.repos.words.dueCards(deps.now);
      const words = due.flatMap((c) => spellingWordById.get(c.wordId) ?? []).slice(0, REVIEW_MAX);
      return { items: buildItems("review", words, ctx, words.length), config: UNTIMED, stageId: null, mode: "review", boss: false };
    }
  }
}
