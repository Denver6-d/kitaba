import type { DiffSegment } from "./diff";

/**
 * The correct spelling split into runs, with the letters the learner got
 * wrong or left out marked as `key` (shown in gold on the correction screen,
 * DESIGN.md V3). Letters the learner typed but should not have are not part
 * of the correct word, so they do not appear. When the learner wrote nothing,
 * no letter is singled out.
 */
export interface CorrectionRun {
  readonly text: string;
  readonly key: boolean;
}

export function correctionRuns(segments: readonly DiffSegment[], word: string): CorrectionRun[] {
  const typedSomething = segments.some((s) => s.kind !== "missing");
  const runs: CorrectionRun[] = [];
  const push = (text: string, key: boolean) => {
    if (text === "") return;
    const last = runs[runs.length - 1];
    if (last && last.key === key) runs[runs.length - 1] = { text: last.text + text, key };
    else runs.push({ text, key });
  };
  for (const s of segments) {
    if (s.kind === "same") push(s.text, false);
    else if (s.kind === "missing") push(s.text, typedSomething);
    else if (s.kind === "wrong") push(s.expected, true);
  }
  // An empty diff (a right spelling marked wrong for another reason, such as picking the wrong word in
  // "fix the mistake"), or a diff for a different form of the word: show the word plainly.
  if (runs.map((r) => r.text).join("") !== word) return [{ text: word, key: false }];
  return runs;
}
