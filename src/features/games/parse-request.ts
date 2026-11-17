import { parseStageId } from "@/domain/games/campaign";
import { LEVELS, type CefrLevel } from "@/domain/model";
import { SPELLING_CATEGORIES } from "@/domain/spelling/categories";
import type { GameRequest } from "./build-session";

const FREE_MODES = ["listen", "bee", "fix", "missing", "scramble", "choice"] as const;
type FreeMode = (typeof FREE_MODES)[number];

const isOneOf = <T extends string>(list: readonly T[], v: string | null): v is T => v !== null && (list as readonly string[]).includes(v);

/**
 * Turns the game URL's search params into a request. Anything unknown falls
 * back to safe defaults, so a hand-edited URL can never break the page.
 */
export function parseGameRequest(params: { get(name: string): string | null }): GameRequest {
  const stage = params.get("stage");
  if (stage !== null && parseStageId(stage)) return { kind: "stage", id: stage };
  if (params.get("daily") !== null) return { kind: "daily" };
  const mode = params.get("mode");
  const level = params.get("level");
  const category = params.get("category");
  return {
    kind: "free",
    mode: isOneOf<FreeMode>(FREE_MODES, mode) ? mode : "listen",
    level: isOneOf<CefrLevel>(LEVELS, level) ? level : null,
    category: isOneOf(SPELLING_CATEGORIES, category) ? category : null,
  };
}

export function freePlayHref(mode: FreeMode, level: CefrLevel | null, category: string | null): string {
  const q = new URLSearchParams({ mode });
  if (level) q.set("level", level);
  if (category) q.set("category", category);
  return `/play/game?${q.toString()}`;
}

export { FREE_MODES };
export type { FreeMode };
