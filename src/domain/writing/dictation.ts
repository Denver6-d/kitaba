import { charDistance } from "../spelling/diff";
import { americanCandidates } from "./british";
import { classifyMistake, type MistakeType } from "./classify";
import { straighten } from "./tokenize";

/**
 * Word-level comparison for sentence and message dictation (DECISIONS F5).
 * Case and punctuation do not count; spelling does. A misspelled word is
 * aligned with the word it was meant to be (a substitution), so the learner
 * sees "recieve → receive" rather than one missing and one extra word.
 */

export type DictationSegment =
  | { readonly kind: "ok"; readonly word: string; readonly typed: string; readonly note?: "british" }
  | { readonly kind: "wrong"; readonly word: string; readonly typed: string; readonly type: MistakeType }
  | { readonly kind: "missing"; readonly word: string }
  | { readonly kind: "extra"; readonly typed: string };

export interface DictationResult {
  readonly segments: readonly DictationSegment[];
  /** Words in the original text. */
  readonly words: number;
  readonly correct: number;
  /** Misspelled, missing and extra words. */
  readonly mistakes: number;
  /** correct / (words + extra words), 0–1: typing extra words lowers it too. */
  readonly accuracy: number;
}

/**
 * Words as they are compared: straight apostrophes, letters and digits. Hyphens
 * count as spaces, so "well-known" typed as "well known" is not a mistake.
 */
export function dictationWords(text: string): string[] {
  return straighten(text)
    .replace(/(?<=[A-Za-z])-(?=[A-Za-z])/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^[^A-Za-z0-9']+|[^A-Za-z0-9']+$/g, "").replace(/^'+|'+$/g, ""))
    .filter((w) => w.length > 0);
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
/** colour for color (or color for colour): the other variant is accepted, with a note. */
const britishOf = (typed: string, word: string) =>
  americanCandidates(typed).includes(word.toLowerCase()) || americanCandidates(word).includes(typed.toLowerCase());

export function compareDictation(expected: string, typed: string): DictationResult {
  const e = dictationWords(expected);
  const t = dictationWords(typed);
  const n = e.length;
  const m = t.length;
  const match = (i: number, j: number) => same(e[i] ?? "", t[j] ?? "") || britishOf(t[j] ?? "", e[i] ?? "");
  // A typed word is paired with an expected word only when it looks like an attempt at it;
  // otherwise it counts as one missing and one extra word.
  const similar = (i: number, j: number) => {
    const a = (e[i] ?? "").toLowerCase();
    const b = (t[j] ?? "").toLowerCase();
    return charDistance(a, b) <= Math.max(2, Math.floor(Math.max(a.length, b.length) / 2));
  };
  const subCost = (i: number, j: number) => (match(i, j) ? 0 : similar(i, j) ? 1 : 3);
  // dp[i][j]: cost of aligning e[i..] with t[j..].
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n; i >= 0; i -= 1) {
    for (let j = m; j >= 0; j -= 1) {
      const row = dp[i] as number[];
      if (i === n) row[j] = m - j;
      else if (j === m) row[j] = n - i;
      else {
        const down = dp[i + 1] as number[];
        row[j] = Math.min((down[j + 1] ?? 0) + subCost(i, j), (down[j] ?? 0) + 1, (row[j + 1] ?? 0) + 1);
      }
    }
  }
  const segments: DictationSegment[] = [];
  let i = 0;
  let j = 0;
  const at = (x: number, y: number) => (dp[x] as number[])[y] ?? 0;
  while (i < n || j < m) {
    const word = e[i] ?? "";
    const tw = t[j] ?? "";
    if (i < n && j < m && at(i, j) === at(i + 1, j + 1) + subCost(i, j)) {
      if (same(word, tw)) segments.push({ kind: "ok", word, typed: tw });
      else if (britishOf(tw, word)) segments.push({ kind: "ok", word, typed: tw, note: "british" });
      else segments.push({ kind: "wrong", word, typed: tw, type: classifyMistake(tw, word) });
      i += 1;
      j += 1;
    } else if (i < n && at(i, j) === at(i + 1, j) + 1) {
      segments.push({ kind: "missing", word });
      i += 1;
    } else {
      segments.push({ kind: "extra", typed: tw });
      j += 1;
    }
  }
  const correct = segments.filter((s) => s.kind === "ok").length;
  const extra = segments.filter((s) => s.kind === "extra").length;
  return { segments, words: n, correct, mistakes: segments.length - correct, accuracy: n + extra === 0 ? 0 : correct / (n + extra) };
}
