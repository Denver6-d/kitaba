"use client";

import { drawFromBag, type BagState } from "@/domain/games/shuffle-bag";
import { seededRng } from "@/domain/shared/random";
import type { OutboxStore } from "@/repositories/local/outbox";

/**
 * Draws the next item id from a persisted shuffle-bag (local only, like the
 * game bags), so scenarios and dictation texts never repeat until the
 * learner has seen the whole pool at their level (SPEC 6.3).
 */
export async function drawNext(meta: OutboxStore, key: string, pool: readonly string[]): Promise<string | null> {
  const bagKey = `bag:${key}`;
  const state = (await meta.getMeta<BagState>(bagKey).catch(() => undefined)) ?? null;
  const { ids, state: next } = drawFromBag(pool, state, 1, seededRng(Date.now() & 0x7fffffff));
  await meta.setMeta(bagKey, next).catch(() => undefined);
  return ids[0] ?? null;
}
