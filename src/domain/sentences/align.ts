import { related } from "./classify";

export type AlignOp =
  | { readonly op: "equal"; readonly expected: string; readonly actual: string }
  | { readonly op: "sub"; readonly expected: string; readonly actual: string }
  | { readonly op: "del"; readonly expected: string }
  | { readonly op: "ins"; readonly actual: string };

export interface Alignment {
  readonly ops: AlignOp[];
  readonly cost: number;
}

const DEL = 1;
const INS = 1;
const SUB_RELATED = 0.5;
const SUB_OTHER = 1;

/**
 * Token-level weighted Levenshtein alignment. Related words (inflections,
 * misspellings, article/preposition/be swaps) are cheaper to substitute, so the
 * alignment lines up "goes" with "go" rather than deleting one and inserting the other.
 * Tie-break order in the backtrace is equal > sub > del > ins, which makes the result deterministic.
 */
export function alignTokens(expected: readonly string[], actual: readonly string[]): Alignment {
  const n = expected.length;
  const m = actual.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 1; i <= n; i += 1) (dp[i] as number[])[0] = i * DEL;
  for (let j = 1; j <= m; j += 1) (dp[0] as number[])[j] = j * INS;

  const subCost = (i: number, j: number): number => {
    const e = expected[i - 1] ?? "";
    const a = actual[j - 1] ?? "";
    if (e === a) return 0;
    return related(e, a) ? SUB_RELATED : SUB_OTHER;
  };
  const at = (i: number, j: number): number => dp[i]?.[j] ?? Infinity;

  for (let i = 1; i <= n; i += 1) {
    const row = dp[i] as number[];
    for (let j = 1; j <= m; j += 1) {
      row[j] = Math.min(at(i - 1, j - 1) + subCost(i, j), at(i - 1, j) + DEL, at(i, j - 1) + INS);
    }
  }

  const ops: AlignOp[] = [];
  let i = n;
  let j = m;
  const eps = 1e-9;
  while (i > 0 || j > 0) {
    const cur = at(i, j);
    if (i > 0 && j > 0 && Math.abs(cur - (at(i - 1, j - 1) + subCost(i, j))) < eps) {
      const e = expected[i - 1] ?? "";
      const a = actual[j - 1] ?? "";
      ops.push(e === a ? { op: "equal", expected: e, actual: a } : { op: "sub", expected: e, actual: a });
      i -= 1;
      j -= 1;
    } else if (i > 0 && Math.abs(cur - (at(i - 1, j) + DEL)) < eps) {
      ops.push({ op: "del", expected: expected[i - 1] ?? "" });
      i -= 1;
    } else {
      ops.push({ op: "ins", actual: actual[j - 1] ?? "" });
      j -= 1;
    }
  }
  ops.reverse();
  return { ops, cost: at(n, m) };
}
