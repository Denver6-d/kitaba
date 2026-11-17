import { shuffle, type Rng } from "../shared/random";

/**
 * Shuffle-bag selection (SPEC 6.3): items are drawn without replacement, so
 * none repeats until the whole pool has been used. On a refill the most
 * recently drawn items go to the back, so the seam between two passes never
 * repeats either. The state is small and JSON-safe (kept in local `meta`).
 */
export interface BagState {
  /** Items not yet drawn in this pass, in draw order. */
  readonly queue: readonly string[];
  /** The most recent draws, newest last (at most RECENT_MAX). */
  readonly recent: readonly string[];
  /** Signature of the pool this state belongs to; a different pool starts a new pass. */
  readonly sig: string;
}

export const RECENT_MAX = 50;

/** Order-independent signature of a pool (FNV-1a over the sorted ids). */
export function poolSignature(pool: readonly string[]): string {
  let h = 0x811c9dc5;
  for (const id of [...pool].sort()) {
    for (let i = 0; i < id.length; i += 1) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193);
    h = Math.imul(h ^ 0x2c, 0x01000193);
  }
  return `${pool.length}:${(h >>> 0).toString(36)}`;
}

/** How many recent items are kept away from the start of a new pass. */
export const recentGuard = (poolSize: number): number => Math.min(10, Math.floor(poolSize / 2));

function refill(pool: readonly string[], recent: readonly string[], rng: Rng): string[] {
  const guard = new Set(recent.slice(-recentGuard(pool.length)));
  const fresh = shuffle(
    pool.filter((id) => !guard.has(id)),
    rng,
  );
  // Recent items keep their relative order at the back, oldest first.
  const tail = recent.slice(-recentGuard(pool.length)).filter((id) => pool.includes(id));
  return [...fresh, ...tail];
}

/**
 * Draws up to `n` distinct ids from `pool`. If the pool changed since the
 * state was saved (a content update), a new pass starts, still keeping the
 * recent draws away from its start.
 */
export function drawFromBag(pool: readonly string[], state: BagState | null, n: number, rng: Rng): { ids: string[]; state: BagState } {
  const unique = [...new Set(pool)];
  const sig = poolSignature(unique);
  if (unique.length === 0 || n <= 0) return { ids: [], state: state ?? { queue: [], recent: [], sig } };
  const inPool = new Set(unique);
  let recent = (state?.recent ?? []).filter((id) => inPool.has(id));
  let queue = state && state.sig === sig ? [...state.queue] : refill(unique, recent, rng);

  const want = Math.min(n, unique.length);
  const ids: string[] = [];
  while (ids.length < want) {
    if (queue.length === 0) queue = refill(unique, recent, rng);
    const next = queue.find((id) => !ids.includes(id));
    if (next === undefined) break;
    queue = queue.filter((id) => id !== next);
    ids.push(next);
    recent = [...recent.filter((id) => id !== next), next].slice(-RECENT_MAX);
  }
  return { ids, state: { queue, recent, sig } };
}

/**
 * Puts drawn ids that were not used (spare words a mode could not turn into an
 * item, or more than a session needed) back at the front of the queue, so they
 * count as unseen and the next session draws them first.
 */
export function returnToBag(state: BagState, unused: readonly string[]): BagState {
  if (unused.length === 0) return state;
  const back = new Set(unused);
  return {
    queue: [...unused.filter((id, i) => unused.indexOf(id) === i), ...state.queue.filter((id) => !back.has(id))],
    recent: state.recent.filter((id) => !back.has(id)),
    sig: state.sig,
  };
}
