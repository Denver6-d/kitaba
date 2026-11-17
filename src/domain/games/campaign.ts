import type { CefrLevel, StageRecord } from "../model";
import type { SpellingCategoryId } from "../spelling/categories";
import type { ItemMode } from "./engine";

/**
 * The campaign: 8 worlds × 10 stages. Each world focuses on a family of
 * spelling problems; stage 10 is the world's challenge (boss) stage. The order
 * starts with the sounds Arabic does not have (p/b, v/f) and the short vowels
 * Arabic does not write, then moves to rules, then to the hardest words.
 */

export interface World {
  readonly n: number;
  readonly name: { readonly ar: string; readonly en: string };
  readonly categories: readonly SpellingCategoryId[];
  /** Easiest first; early stages use only the first level. */
  readonly levels: readonly CefrLevel[];
}

export const WORLDS: readonly World[] = [
  { n: 1, name: { ar: "أصوات ليست في العربية", en: "Sounds Arabic doesn't have" }, categories: ["p-b", "v-f"], levels: ["A1", "A2", "B1"] },
  { n: 2, name: { ar: "الحركات التي لا تُكتب", en: "The vowels Arabic leaves out" }, categories: ["short-vowels", "vowel-confusion"], levels: ["A1", "A2", "B1"] },
  { n: 3, name: { ar: "الحروف المضاعفة", en: "Double letters" }, categories: ["double-letters"], levels: ["A1", "A2", "B1", "B2"] },
  { n: 4, name: { ar: "حروف تُكتب ولا تُنطق", en: "Silent letters" }, categories: ["silent-letters"], levels: ["A1", "A2", "B1", "B2"] },
  { n: 5, name: { ar: "نهايات الكلمات", en: "Word endings" }, categories: ["plurals", "verb-endings", "adverbs-ly"], levels: ["A2", "B1", "B2"] },
  { n: 6, name: { ar: "فخاخ ie وei وغيرها", en: "ie, ei and other traps" }, categories: ["ie-ei", "common"], levels: ["A2", "B1", "B2"] },
  { n: 7, name: { ar: "بناء الكلمات", en: "Building words" }, categories: ["prefixes", "suffixes", "british-american"], levels: ["B1", "B2", "C1"] },
  { n: 8, name: { ar: "كلمات متشابهة وأصعب الكلمات", en: "Sound-alikes and the hardest words" }, categories: ["homophones", "common"], levels: ["B1", "B2", "C1"] },
];

export const WORLD_COUNT = WORLDS.length;
export const STAGES_PER_WORLD = 10;
export const BOSS_STAGE = 10;

/** Mode of each stage (index 0 = stage 1). Stage 10 is mixed (boss). */
const STAGE_MODES: readonly (ItemMode | readonly ItemMode[])[] = [
  "listen",
  "choice",
  "missing",
  "listen",
  "scramble",
  "fix",
  "choice",
  "missing",
  "bee",
  ["listen", "fix", "choice", "missing", "sentence", "listen", "scramble", "choice", "fix", "listen", "sentence", "missing"],
];

export interface StageDef {
  readonly id: string;
  readonly world: World;
  readonly n: number;
  readonly boss: boolean;
  readonly modes: ItemMode | readonly ItemMode[];
  readonly items: number;
  readonly timed: boolean;
  readonly levels: readonly CefrLevel[];
}

export const stageId = (world: number, stage: number): string => `w${world}-s${stage}`;

const STAGE_RE = /^w(\d+)-s(\d+)$/;

export function parseStageId(id: string): { world: number; stage: number } | null {
  const m = STAGE_RE.exec(id);
  if (!m) return null;
  const world = Number(m[1]);
  const stage = Number(m[2]);
  if (world < 1 || world > WORLD_COUNT || stage < 1 || stage > STAGES_PER_WORLD) return null;
  return { world, stage };
}

export const isBossStage = (id: string): boolean => parseStageId(id)?.stage === BOSS_STAGE;

export function stageDef(id: string): StageDef | null {
  const p = parseStageId(id);
  const world = p ? WORLDS[p.world - 1] : undefined;
  if (!p || !world) return null;
  const modes = STAGE_MODES[p.stage - 1] ?? "listen";
  const first = world.levels.slice(0, 1);
  const firstTwo = world.levels.slice(0, 2);
  const levels = p.stage <= 3 ? first : p.stage <= 6 ? firstTwo : world.levels;
  return {
    id,
    world,
    n: p.stage,
    boss: p.stage === BOSS_STAGE,
    modes,
    items: Array.isArray(modes) ? modes.length : 10,
    timed: modes === "bee",
    levels,
  };
}

export const ALL_STAGE_IDS: readonly string[] = WORLDS.flatMap((w) => Array.from({ length: STAGES_PER_WORLD }, (_, i) => stageId(w.n, i + 1)));

const cleared = (stages: Readonly<Record<string, StageRecord>>, id: string) => (stages[id]?.stars ?? 0) > 0;

export function isWorldUnlocked(world: number, stages: Readonly<Record<string, StageRecord>>): boolean {
  return world === 1 || cleared(stages, stageId(world - 1, BOSS_STAGE));
}

/** A stage is open when its world is open and the previous stage has at least one star. */
export function isStageUnlocked(id: string, stages: Readonly<Record<string, StageRecord>>): boolean {
  const p = parseStageId(id);
  if (!p || !isWorldUnlocked(p.world, stages)) return false;
  return p.stage === 1 || cleared(stages, stageId(p.world, p.stage - 1));
}

/** The first unlocked stage without stars (where to continue), or the last stage. */
export function nextStageToPlay(stages: Readonly<Record<string, StageRecord>>): string {
  return ALL_STAGE_IDS.find((id) => isStageUnlocked(id, stages) && !cleared(stages, id)) ?? ALL_STAGE_IDS[ALL_STAGE_IDS.length - 1] ?? stageId(1, 1);
}

export function nextStageAfter(id: string): string | null {
  const i = ALL_STAGE_IDS.indexOf(id);
  return i >= 0 && i + 1 < ALL_STAGE_IDS.length ? (ALL_STAGE_IDS[i + 1] ?? null) : null;
}

/** Daily challenge: 10 items in rotating modes. */
export const DAILY_MODES: readonly ItemMode[] = ["listen", "choice", "missing", "fix", "scramble", "listen", "choice", "fix", "missing", "listen"];
export const dailyId = (day: string): string => `daily:${day}`;

/** A stable 32-bit seed from a string (e.g. the day key), for the shared daily selection. */
export function seedFrom(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
