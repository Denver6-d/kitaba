/** Level bands for library words (pure). */

/** Upper frequency rank (inclusive) of each level. */
export const BANDS = [
  ["A1", 600],
  ["A2", 2_000],
  ["B1", 4_500],
  ["B2", 8_000],
  ["C1", Infinity],
];
export const LEVELS = BANDS.map(([l]) => l);

/** Level from the frequency rank; a word SCOWL only lists at size 50+ is never easier than B2. */
export function levelFor(rank, tier) {
  const band = BANDS.find(([, max]) => rank <= max)[0];
  return tier >= 50 && LEVELS.indexOf(band) < LEVELS.indexOf("B2") ? "B2" : band;
}
