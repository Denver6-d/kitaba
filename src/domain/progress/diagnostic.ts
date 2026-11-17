export type CefrLevel = "A1" | "A2" | "B1";
export const CEFR_LEVELS: readonly CefrLevel[] = ["A1", "A2", "B1"];

export type PlanStep = "foundation" | "typing" | "spelling" | "sentences" | "professional";

export interface DiagnosticInput {
  readonly wpm: number;
  readonly accuracy: number;
  readonly spellingCorrect: number;
  readonly spellingTotal: number;
  /** One score in [0, 1] per sentence (from the sentence grader). */
  readonly sentenceScores: readonly number[];
}

/** Typing speed at which the typing component is considered "fine" for placement. */
const WPM_TARGET = 40;

const ratio = (n: number, d: number): number => (d <= 0 ? 0 : Math.max(0, Math.min(1, n / d)));
const avg = (xs: readonly number[]): number => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);

function areaScores(i: DiagnosticInput) {
  return {
    typing: ratio(i.wpm, WPM_TARGET) * ratio(i.accuracy, 100),
    spelling: ratio(i.spellingCorrect, i.spellingTotal),
    sentences: avg(i.sentenceScores),
  };
}

/**
 * Placement is weighted toward writing (sentences, spelling) because the
 * levels describe English writing, not typing speed. It is a starting point,
 * not a certified CEFR level, and the UI says so.
 */
export function placeLevel(i: DiagnosticInput): CefrLevel {
  const s = areaScores(i);
  const composite = 0.5 * s.sentences + 0.35 * s.spelling + 0.15 * ratio(i.wpm, WPM_TARGET);
  if (composite >= 0.75) return "B1";
  if (composite >= 0.45) return "A2";
  return "A1";
}

/** Practice plan, weakest area first. Professional writing always closes the plan. */
export function buildPlan(i: DiagnosticInput): PlanStep[] {
  const s = areaScores(i);
  const plan: PlanStep[] = [];
  if (i.wpm < 20 || i.accuracy < 90) plan.push("foundation");
  const areas: Array<[PlanStep, number]> = [
    ["typing", s.typing],
    ["spelling", s.spelling],
    ["sentences", s.sentences],
  ];
  areas.sort((a, b) => a[1] - b[1]);
  for (const [step] of areas) plan.push(step);
  plan.push("professional");
  return plan;
}
