/**
 * Letter-level comparison of a learner's answer with the expected spelling.
 * Pure and deterministic; used for SM-2 quality, feedback and misspelling checks.
 */

/** Levenshtein distance (insert, delete, substitute = 1). */
export function charDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min((prev[j] ?? 0) + 1, (cur[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    prev = cur;
  }
  return prev[b.length] ?? 0;
}

/**
 * One segment of the diff, in the expected word's reading order.
 * - same: letters the learner got right
 * - missing: letters the learner left out (shown inserted)
 * - extra: letters the learner added (shown struck)
 * - wrong: the learner's letters where the expected ones differ (`expected` holds the right ones)
 */
export type DiffSegment =
  | { readonly kind: "same"; readonly text: string }
  | { readonly kind: "missing"; readonly text: string }
  | { readonly kind: "extra"; readonly text: string }
  | { readonly kind: "wrong"; readonly text: string; readonly expected: string };

type Op = { kind: "same" | "sub"; a: string; e: string } | { kind: "ins"; e: string } | { kind: "del"; a: string };

/** Aligns `answer` against `expected` and returns merged segments for display. */
export function letterDiff(answer: string, expected: string): DiffSegment[] {
  const n = answer.length;
  const m = expected.length;
  // dp[i][j] = distance between answer[0..i) and expected[0..j)
  const dp: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i += 1) {
    const row = dp[i] as number[];
    const up = dp[i - 1] as number[];
    for (let j = 1; j <= m; j += 1) {
      const cost = answer[i - 1] === expected[j - 1] ? 0 : 1;
      row[j] = Math.min((up[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, (up[j - 1] ?? 0) + cost);
    }
  }
  const ops: Op[] = [];
  let i = n;
  let j = m;
  const at = (x: number, y: number) => (dp[x] as number[])[y] ?? 0;
  while (i > 0 || j > 0) {
    const a = answer[i - 1] ?? "";
    const e = expected[j - 1] ?? "";
    // On ties, extra and missing letters are placed as late as possible ("untill" → until + "l").
    if (i > 0 && at(i, j) === at(i - 1, j) + 1) {
      ops.push({ kind: "del", a });
      i -= 1;
    } else if (j > 0 && at(i, j) === at(i, j - 1) + 1) {
      ops.push({ kind: "ins", e });
      j -= 1;
    } else {
      ops.push({ kind: a === e ? "same" : "sub", a, e });
      i -= 1;
      j -= 1;
    }
  }
  ops.reverse();

  const out: DiffSegment[] = [];
  const push = (seg: DiffSegment) => {
    const last = out[out.length - 1];
    if (last && last.kind === seg.kind) {
      if (last.kind === "wrong" && seg.kind === "wrong") {
        out[out.length - 1] = { kind: "wrong", text: last.text + seg.text, expected: last.expected + seg.expected };
      } else if (last.kind !== "wrong" && seg.kind !== "wrong") {
        out[out.length - 1] = { kind: last.kind, text: last.text + seg.text };
      }
      return;
    }
    out.push(seg);
  };
  for (const op of ops) {
    if (op.kind === "same") push({ kind: "same", text: op.a });
    else if (op.kind === "sub") push({ kind: "wrong", text: op.a, expected: op.e });
    else if (op.kind === "ins") push({ kind: "missing", text: op.e });
    else push({ kind: "extra", text: op.a });
  }
  return out;
}
