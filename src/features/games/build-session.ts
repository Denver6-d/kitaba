"use client";

import { spellingWordById, spellingWords } from "@/data/words";
import type { SpellingWord } from "@/data/schema";
import { DAILY_MODES, dailyId, seedFrom, stageDef } from "@/domain/games/campaign";
import type { GameConfig, GameItem, ItemMode } from "@/domain/games/engine";
import { drawFromBag, returnToBag, type BagState } from "@/domain/games/shuffle-bag";
import { buildItems } from "@/domain/games/session";
import type { CefrLevel, GameMode } from "@/domain/model";
import { dayKey } from "@/domain/progress/streak";
import { poolAtLevel } from "@/domain/levels/pool";
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
  /** Mastery per word id when the session was built (Arabic hint fading). */
  readonly mastery: Readonly<Record<string, number>>;
  /** The learner level the words were chosen for (null for review). Shown in the game header. */
  readonly level: CefrLevel | null;
}

const UNTIMED: GameConfig = { durationMs: null, speedBonus: false };
const BEE: GameConfig = { durationMs: 60_000, speedBonus: true };
/** Enough words for a fast 60-second Spelling Bee. */
const BEE_WORDS = 40;
const FREE_ITEMS = 10;
const REVIEW_MAX = 15;
/** Spare words so a word that cannot make an item in a mode can be skipped. */
const SPARE = 6;
/** A timed stage needs a pool this big (the content validator checks every world and level). */
export const STAGE_MIN_TIMED = 25;
/** A one-category free play widens past the level only when fewer words than this are left. */
const FREE_MIN_CATEGORY = 8;

export const bankSpellings: ReadonlySet<string> = new Set(spellingWords.flatMap((w) => (w.uk ? [w.word, w.uk] : [w.word])));

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

export async function buildSession(
  req: GameRequest,
  deps: { readonly repos: Repositories; readonly meta: OutboxStore; readonly accent: Accent; readonly rng: Rng; readonly now: number },
): Promise<BuiltSession> {
  const [session, all] = await Promise.all([buildItemsFor(req, deps), deps.repos.mastery.all().catch(() => ({}) as Record<string, number>)]);
  const mastery = Object.fromEntries(Object.entries(all).filter(([k]) => k.startsWith("spell:")).map(([k, v]) => [k.slice(6), v]));
  return { ...session, mastery };
}

async function buildItemsFor(
  req: GameRequest,
  deps: { readonly repos: Repositories; readonly meta: OutboxStore; readonly accent: Accent; readonly rng: Rng; readonly now: number },
): Promise<Omit<BuiltSession, "mastery">> {
  const ctx = { accent: deps.accent, rng: deps.rng, bankSpellings };
  // Read the stored levels on every build, so a level changed in the menu applies to the very next game.
  const { levels } = req.kind === "review" ? { levels: null } : await deps.repos.profile.get();
  switch (req.kind) {
    case "stage": {
      const def = stageDef(req.id);
      if (!def || !levels) return { items: [], config: UNTIMED, stageId: req.id, mode: "listen", boss: false, level: null };
      // Bosses are tests; the other stages are word games (DECISIONS E2).
      const level = def.boss ? levels.tests : levels.words;
      const count = def.timed ? BEE_WORDS : def.items;
      const inWorld = spellingWords.filter((w) => def.world.categories.includes(w.category));
      const { pool, levels: used } = poolAtLevel(inWorld, level, def.timed ? STAGE_MIN_TIMED : count + SPARE);
      // The level is part of the bag key: changing it starts a fresh pass at once.
      const key = `stage:${def.id}:${used.join("")}`;
      const items = await drawAndBuild(deps.meta, key, pool, count + SPARE, deps.rng, (words) => buildItems(def.modes, words, ctx, count));
      const mode: GameMode = Array.isArray(def.modes) ? "mixed" : (def.modes as GameMode);
      return { items, config: def.timed ? BEE : UNTIMED, stageId: def.id, mode, boss: def.boss, level };
    }
    case "daily": {
      // Everyone at the same tests level gets the same words on the same day.
      const day = dayKey(new Date(deps.now));
      const level = levels?.tests ?? "A2";
      const rng = seededRng(seedFrom(`${day}:${level}`));
      const { pool } = poolAtLevel(spellingWords, level, 60);
      const words = shuffle(pool, rng).slice(0, DAILY_MODES.length + SPARE);
      return {
        items: buildItems(DAILY_MODES, words, { ...ctx, rng }, DAILY_MODES.length),
        config: UNTIMED,
        stageId: dailyId(day),
        mode: "mixed",
        boss: false,
        level,
      };
    }
    case "free": {
      // An explicit level in the URL wins; otherwise the learner's words level.
      const level = req.level ?? levels?.words ?? "A2";
      const timed = req.mode === "bee";
      const count = timed ? BEE_WORDS : FREE_ITEMS;
      const inCategory = spellingWords.filter((w) => req.category === null || w.category === req.category);
      const { pool, levels: used } = poolAtLevel(inCategory, level, req.category === null ? count + SPARE : FREE_MIN_CATEGORY);
      const key = `free:${used.join("")}:${req.category ?? "all"}`;
      const items = await drawAndBuild(deps.meta, key, pool, count + SPARE, deps.rng, (words) => buildItems(req.mode as ItemMode, words, ctx, count));
      return { items, config: timed ? BEE : UNTIMED, stageId: null, mode: req.mode, boss: false, level };
    }
    case "review": {
      const due = await deps.repos.words.dueCards(deps.now);
      const words = due.flatMap((c) => spellingWordById.get(c.wordId) ?? []).slice(0, REVIEW_MAX);
      return { items: buildItems("review", words, ctx, words.length), config: UNTIMED, stageId: null, mode: "review", boss: false, level: null };
    }
  }
}
