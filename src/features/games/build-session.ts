"use client";

import { spellingWordById, spellingWords } from "@/data/words";
import type { PlayWord } from "@/data/play-word";
import { DAILY_MODES, dailyId, seedFrom, stageDef } from "@/domain/games/campaign";
import type { GameConfig, GameItem, ItemMode } from "@/domain/games/engine";
import { drawFromBag, returnToBag, type BagState } from "@/domain/games/shuffle-bag";
import { buildItems } from "@/domain/games/session";
import type { CefrLevel, GameMode, SrsCardRecord } from "@/domain/model";
import { dayKey } from "@/domain/progress/streak";
import { poolAtLevel } from "@/domain/levels/pool";
import { seededRng, shuffle, type Rng } from "@/domain/shared/random";
import type { Accent } from "@/domain/spelling/check";
import { getLibrary, LIBRARY_WAIT_MS, withTimeout, type Library } from "@/features/library/library";
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
  /** Every word the items use, bank and library (the UI never looks words up elsewhere). */
  readonly words: ReadonlyMap<string, PlayWord>;
  /** Review only: words from free writing or dictation that are not in any word list (DECISIONS F7). */
  readonly extraWords?: ReadonlyMap<string, PlayWord>;
}

/** Arabic label for a review word that came from the learner's own writing (it has no dictionary meaning). */
export const WRITING_WORD_AR = "كلمة من كتابتك";

/** A review word built from an SM-2 card written by the sentences and messages section. */
export function writingWord(card: SrsCardRecord): PlayWord | null {
  if (!card.word) return null;
  return {
    id: card.wordId,
    word: card.word.toLowerCase(),
    ar: WRITING_WORD_AR,
    level: "B1",
    category: "common",
    example: card.context && card.context.toLowerCase().includes(card.word.toLowerCase()) ? card.context : `${card.word}.`,
  };
}

/**
 * A library word rebuilt from its id when the library cannot be loaded (offline before it was
 * stored, or a word dropped by a content update), so a due card is still played. It has no hint
 * and no example; "w-well-known" reads as "well-known".
 */
export function wordFromId(id: string): PlayWord | null {
  const m = /^w-([a-z]+(?:-[a-z]+)*)$/.exec(id);
  if (!m?.[1]) return null;
  return { id, word: m[1], level: "B1", category: "common", library: true };
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

/** Every spelling in the hand-written bank: distractors must not be real words (homophones excepted). */
export const bankSpellings: ReadonlySet<string> = new Set(spellingWords.flatMap((w) => (w.uk ? [w.word, w.uk] : [w.word])));

const BAG_PREFIX = "bag:";

type Deps = {
  readonly repos: Repositories;
  readonly meta: OutboxStore;
  readonly accent: Accent;
  readonly rng: Rng;
  readonly now: number;
  /** The open-data library; defaults to the browser's (empty on the server and in tests). */
  readonly library?: Library;
};

/**
 * The words a session at `level` can draw from: the bundled bank (every level,
 * so a short world can widen) plus the library words at that level, which load
 * on demand. When the library is unavailable (offline before it was stored),
 * the bank alone is used, so a game always starts.
 */
async function wordsFor(level: CefrLevel, library: Library): Promise<PlayWord[]> {
  // A stalled connection must not hang the game: after a short wait, play from the bank.
  const extra = await withTimeout(library.wordsAt(level), LIBRARY_WAIT_MS, []);
  return extra.length ? [...spellingWords, ...extra] : [...spellingWords];
}

const spellingsOf = (words: readonly PlayWord[]): Set<string> => new Set(words.flatMap((w) => (w.uk ? [w.word, w.uk] : [w.word])));

/**
 * Draws from a persisted shuffle-bag (local only, never synced), builds the
 * items, and returns the words that were not used to the bag, so words do not
 * repeat until the pool is used up.
 */
async function drawAndBuild(
  meta: OutboxStore,
  key: string,
  pool: readonly PlayWord[],
  n: number,
  rng: Rng,
  build: (words: PlayWord[]) => GameItem[],
): Promise<{ items: GameItem[]; words: Map<string, PlayWord> }> {
  const byId = new Map(pool.map((w) => [w.id, w]));
  const state = (await meta.getMeta<BagState>(BAG_PREFIX + key).catch(() => undefined)) ?? null;
  const { ids, state: next } = drawFromBag([...byId.keys()], state, n, rng);
  const items = build(ids.flatMap((id) => byId.get(id) ?? []));
  const used = new Set(items.map((i) => i.wordId));
  await meta.setMeta(BAG_PREFIX + key, returnToBag(next, ids.filter((id) => !used.has(id)))).catch(() => undefined);
  return { items, words: usedWords(items, byId) };
}

function usedWords(items: readonly GameItem[], byId: ReadonlyMap<string, PlayWord>): Map<string, PlayWord> {
  return new Map(items.flatMap((i) => (byId.has(i.wordId) ? [[i.wordId, byId.get(i.wordId)!] as const] : [])));
}

export async function buildSession(req: GameRequest, deps: Deps): Promise<BuiltSession> {
  const [session, all] = await Promise.all([buildItemsFor(req, deps), deps.repos.mastery.all().catch(() => ({}) as Record<string, number>)]);
  const mastery = Object.fromEntries(Object.entries(all).filter(([k]) => k.startsWith("spell:")).map(([k, v]) => [k.slice(6), v]));
  return { ...session, mastery };
}

async function buildItemsFor(req: GameRequest, deps: Deps): Promise<Omit<BuiltSession, "mastery">> {
  const library = deps.library ?? getLibrary();
  // Read the stored levels on every build, so a level changed in the menu applies to the very next game.
  const { levels } = await deps.repos.profile.get().catch(() => ({ levels: null }));
  const ctxFor = (words: readonly PlayWord[], rng: Rng = deps.rng) => ({ accent: deps.accent, rng, bankSpellings: spellingsOf(words) });
  const empty = new Map<string, PlayWord>();
  switch (req.kind) {
    case "stage": {
      const def = stageDef(req.id);
      if (!def || !levels) return { items: [], config: UNTIMED, stageId: req.id, mode: "listen", boss: false, level: null, words: empty };
      // Bosses are tests; the other stages are word games (DECISIONS E2).
      const level = def.boss ? levels.tests : levels.words;
      const count = def.timed ? BEE_WORDS : def.items;
      const all = await wordsFor(level, library);
      const inWorld = all.filter((w) => def.world.categories.includes(w.category));
      const { pool, levels: used } = poolAtLevel(inWorld, level, def.timed ? STAGE_MIN_TIMED : count + SPARE);
      // The level is part of the bag key: changing it starts a fresh pass at once.
      const key = `stage:${def.id}:${used.join("")}`;
      const { items, words } = await drawAndBuild(deps.meta, key, pool, count + SPARE, deps.rng, (ws) => buildItems(def.modes, ws, ctxFor(all), count));
      const mode: GameMode = Array.isArray(def.modes) ? "mixed" : (def.modes as GameMode);
      return { items, config: def.timed ? BEE : UNTIMED, stageId: def.id, mode, boss: def.boss, level, words };
    }
    case "daily": {
      // Everyone at the same tests level gets the same words on the same day, so the daily draws from
      // the bundled bank only: it does not depend on whether the library has loaded (DECISIONS OD15).
      const day = dayKey(new Date(deps.now));
      const level = levels?.tests ?? "A2";
      const rng = seededRng(seedFrom(`${day}:${level}`));
      const all: PlayWord[] = [...spellingWords];
      const { pool } = poolAtLevel(all, level, 60);
      const picked = shuffle(pool, rng).slice(0, DAILY_MODES.length + SPARE);
      const items = buildItems(DAILY_MODES, picked, ctxFor(all, rng), DAILY_MODES.length);
      return {
        items,
        config: UNTIMED,
        stageId: dailyId(day),
        mode: "mixed",
        boss: false,
        level,
        words: usedWords(items, new Map(picked.map((w) => [w.id, w]))),
      };
    }
    case "free": {
      // An explicit level in the URL wins; otherwise the learner's words level.
      const level = req.level ?? levels?.words ?? "A2";
      const timed = req.mode === "bee";
      const count = timed ? BEE_WORDS : FREE_ITEMS;
      const all = await wordsFor(level, library);
      const inCategory = all.filter((w) => req.category === null || w.category === req.category);
      const { pool, levels: used } = poolAtLevel(inCategory, level, req.category === null ? count + SPARE : FREE_MIN_CATEGORY);
      const key = `free:${used.join("")}:${req.category ?? "all"}`;
      const { items, words } = await drawAndBuild(deps.meta, key, pool, count + SPARE, deps.rng, (ws) => buildItems(req.mode as ItemMode, ws, ctxFor(all), count));
      return { items, config: timed ? BEE : UNTIMED, stageId: null, mode: req.mode, boss: false, level, words };
    }
    case "review": {
      const due = await deps.repos.words.dueCards(deps.now);
      // Library words are found by id, nearest the learner's level first.
      const unknown = due.map((c) => c.wordId).filter((id) => !spellingWordById.has(id) && !id.startsWith("x-"));
      // Rebuild a word from its id only when the library cannot be reached; a word the library no longer has was removed.
      const libraryReachable = unknown.length > 0 && (await withTimeout(library.manifest(), LIBRARY_WAIT_MS, null)) !== null;
      const fromLibrary = await withTimeout(library.findWords(unknown, levels?.words ?? "A2"), LIBRARY_WAIT_MS, new Map<string, PlayWord>());
      const extra = new Map<string, PlayWord>();
      const words = due
        .flatMap((c): PlayWord[] => {
          const known = spellingWordById.get(c.wordId) ?? fromLibrary.get(c.wordId) ?? (libraryReachable ? null : wordFromId(c.wordId));
          if (known) return [known];
          const own = writingWord(c);
          if (own) extra.set(own.id, own);
          return own ? [own] : [];
        })
        .slice(0, REVIEW_MAX);
      const items = buildItems("review", words, ctxFor([...spellingWords, ...words]), words.length);
      return { items, config: UNTIMED, stageId: null, mode: "review", boss: false, level: null, words: usedWords(items, new Map(words.map((w) => [w.id, w]))), extraWords: extra };
    }
  }
}
