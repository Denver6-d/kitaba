import { pickIndex, type Rng } from "../shared/random";

/**
 * Build practice text that over-represents the learner's weakest keys.
 * Items (phrases first, then words) are ranked by the share of their
 * characters that are weak keys, and the drill samples from the top of that
 * ranking until it reaches `minLength` characters.
 */
export function buildDrill(weakKeys: readonly string[], pool: readonly string[], minLength: number, rng: Rng): string {
  if (pool.length === 0) return "";
  const weak = new Set(weakKeys.map((k) => k.toLowerCase()));

  const ranked = pool
    .map((item, index) => ({ item, index, score: density(item, weak) }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const topCount = weak.size === 0 ? ranked.length : Math.max(3, Math.ceil(ranked.length * 0.4));
  const candidates = ranked.slice(0, Math.min(topCount, ranked.length)).map((r) => r.item);

  const parts: string[] = [];
  let length = 0;
  let last = -1;
  while (length < minLength) {
    let i = pickIndex(rng, candidates.length);
    if (candidates.length > 1 && i === last) i = (i + 1) % candidates.length;
    last = i;
    const item = candidates[i] ?? "";
    parts.push(item);
    length += item.length + (parts.length > 1 ? 1 : 0);
  }
  return parts.join(" ");
}

function density(item: string, weak: ReadonlySet<string>): number {
  if (item.length === 0 || weak.size === 0) return 0;
  let n = 0;
  for (const ch of item.toLowerCase()) if (weak.has(ch)) n += 1;
  return n / item.length;
}
