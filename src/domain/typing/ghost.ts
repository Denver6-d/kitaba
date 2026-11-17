import type { EngineState } from "./engine";

/** [ms since start, caret position]. Compact enough to store with every best run. */
export type GhostPoint = readonly [number, number];
export type Ghost = readonly GhostPoint[];

export const GHOST_MAX_POINTS = 400;

export function recordGhost(state: EngineState, maxPoints = GHOST_MAX_POINTS): GhostPoint[] {
  if (state.startedAt === null) return [];
  const start = state.startedAt;
  const points: GhostPoint[] = [];
  let pos = 0;
  for (const k of state.log) {
    if (k.kind === "layout-mismatch") continue;
    pos += k.kind === "correction" ? -1 : 1;
    points.push([k.t - start, Math.max(0, pos)]);
  }
  return downsample(points, maxPoints);
}

function downsample(points: GhostPoint[], max: number): GhostPoint[] {
  if (points.length <= max || max < 2) return points;
  const out: GhostPoint[] = [];
  for (let i = 0; i < max; i += 1) {
    const p = points[Math.round((i * (points.length - 1)) / (max - 1))];
    if (p) out.push(p);
  }
  return out;
}

/** Caret position of the ghost `ms` after the start (binary search). */
export function ghostPositionAt(ghost: Ghost, ms: number): number {
  let lo = 0;
  let hi = ghost.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const p = ghost[mid];
    if (p && p[0] <= ms) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found === -1 ? 0 : (ghost[found]?.[1] ?? 0);
}
