import { pickIndex, type Rng } from "../shared/random";

export const CUSTOM_TEXT_MAX = 2000;

export interface SanitizedText {
  readonly text: string;
  /** True when characters had to be removed (Arabic, emoji, symbols outside ASCII). */
  readonly stripped: boolean;
  readonly tooLong: boolean;
}

const REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/[‘’ʼ]/g, "'"],
  [/[“”]/g, '"'],
  [/[–—]/g, "-"],
  [/…/g, "..."],
  [/ /g, " "],
];

/** Turns pasted text into something typable on a US keyboard. */
export function sanitizeCustomText(raw: string, max = CUSTOM_TEXT_MAX): SanitizedText {
  let text = raw;
  for (const [re, to] of REPLACEMENTS) text = text.replace(re, to);
  text = text.replace(/\s+/g, " ");
  const ascii = text.replace(/[^\x20-\x7E]/g, "");
  const stripped = ascii !== text;
  const clean = ascii.replace(/ {2,}/g, " ").trim();
  return { text: clean, stripped, tooLong: clean.length > max };
}

export interface TextSegment {
  readonly id: string;
  readonly start: number;
  readonly end: number;
}

export interface TestText {
  readonly text: string;
  readonly segments: readonly TextSegment[];
}

/** Concatenates random items (never the same one twice in a row) until `minLength` characters. */
export function buildTestText(items: ReadonlyArray<{ id: string; text: string }>, minLength: number, rng: Rng): TestText {
  if (items.length === 0) return { text: "", segments: [] };
  const segments: TextSegment[] = [];
  let text = "";
  let last = -1;
  while (text.length < minLength) {
    let i = pickIndex(rng, items.length);
    if (items.length > 1 && i === last) i = (i + 1) % items.length;
    last = i;
    const item = items[i];
    if (!item) break;
    if (text.length > 0) text += " ";
    segments.push({ id: item.id, start: text.length, end: text.length + item.text.length });
    text += item.text;
  }
  return { text, segments };
}

export function segmentAt(segments: readonly TextSegment[], index: number): TextSegment | undefined {
  return segments.find((s) => index >= s.start && index <= s.end);
}
