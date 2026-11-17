export type TestSource = "words" | "sentences" | "custom" | "adaptive" | "lesson" | "diagnostic";
export type TestDuration = 15 | 30 | 60;
export const TEST_DURATIONS: readonly TestDuration[] = [15, 30, 60];

export function modeKey(source: TestSource, duration: number): string {
  return `${source}:${duration}`;
}

export interface PersonalBest {
  readonly modeKey: string;
  readonly wpm: number;
  readonly accuracy: number;
  readonly at: number;
}

export type PersonalBests = Readonly<Record<string, PersonalBest>>;

/** A fast run full of mistakes is not a record worth chasing. */
export const PB_MIN_ACCURACY = 80;

export function updatePersonalBests(
  bests: PersonalBests,
  result: PersonalBest,
): { bests: PersonalBests; isNew: boolean } {
  if (result.accuracy < PB_MIN_ACCURACY) return { bests, isNew: false };
  const prev = bests[result.modeKey];
  if (prev && prev.wpm >= result.wpm) return { bests, isNew: false };
  return { bests: { ...bests, [result.modeKey]: result }, isNew: true };
}
