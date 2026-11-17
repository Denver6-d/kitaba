import type { GameItem, ItemMode } from "./engine";
import { buildItem, type BuildContext, type ItemWord } from "./items";

/**
 * Builds the items of a session from chosen words. A word that cannot make an
 * item in this mode (e.g. no misspelling generator hit) is skipped; callers
 * pass a few spare words so the session still has `count` items.
 */
export function buildItems(mode: ItemMode | readonly ItemMode[], words: readonly ItemWord[], ctx: BuildContext, count: number): GameItem[] {
  const modes = typeof mode === "string" ? [mode] : mode;
  const out: GameItem[] = [];
  for (const w of words) {
    if (out.length >= count) break;
    const m = modes[out.length % modes.length] ?? "listen";
    const item = buildItem(m, w, ctx, `${out.length}:${m}:${w.id}`) ?? (m === "listen" ? null : buildItem("listen", w, ctx, `${out.length}:listen:${w.id}`));
    if (item) out.push(item);
  }
  return out;
}
