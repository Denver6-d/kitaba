import { letterDiff } from "../spelling/diff";

/**
 * Names the kind of spelling mistake, so the learner gets a short rule
 * (the Arabic and English texts live in i18n, `writing.types`). Rule-based:
 * it compares the misspelling with the right spelling letter by letter.
 */
export const MISTAKE_TYPES = [
  "double",
  "ie-ei",
  "silent",
  "vowel",
  "p-b",
  "v-f",
  "confusable",
  "british",
  "apostrophe",
  "capital",
  "order",
  "ending",
  "split",
  "other",
] as const;
export type MistakeType = (typeof MISTAKE_TYPES)[number];

const VOWELS = new Set("aeiouy");
const SILENT_RE = /kn|wr|mb|gh|bt|ps|mn|nm|sc|wh|lk|lm|stl|stle|dg|rh|gu|ho|ck|ign|dn|dw/g;
const ENDINGS_RE = /(ed|ing|ly|es|s|ful|ment|tion|sion|ness|able|ible|er|est)$/;

const collapseDoubles = (s: string) => s.replace(/(.)\1+/g, "$1");
const sorted = (s: string) => [...s].sort().join("");

/** Positions in `right` covered by a silent-letter pattern (kn, wr, mb, gh…). */
function silentPositions(right: string): Set<number> {
  const out = new Set<number>();
  for (const m of right.matchAll(SILENT_RE)) for (let i = 0; i < m[0].length; i += 1) out.add((m.index ?? 0) + i);
  return out;
}

/** Classifies `wrong` (as typed, any case) against `right`. */
export function classifyMistake(wrong: string, right: string): MistakeType {
  if (wrong.toLowerCase() === right.toLowerCase()) return "capital";
  const w = wrong.toLowerCase().replace(/[‘’]/g, "'");
  const r = right.toLowerCase();
  if (w === r) return "capital";
  if (r.includes(" ") && w === r.replace(/ /g, "")) return "split";
  if (r.includes("'") && w === r.replace(/'/g, "")) return "apostrophe";
  if (collapseDoubles(w) === collapseDoubles(r)) return "double";
  if (w.replace(/ie|ei/g, "_") === r.replace(/ie|ei/g, "_") && /ie|ei/.test(r)) return "ie-ei";

  const diff = letterDiff(w, r);
  const changed = diff.filter((d) => d.kind !== "same");
  const subs = changed.filter((d) => d.kind === "wrong");
  if (changed.length > 0 && changed.every((d) => d.kind === "wrong")) {
    const pairs = subs.flatMap((d) => (d.kind === "wrong" ? [...d.text].map((c, i) => `${c}${d.expected[i] ?? ""}`) : []));
    if (pairs.every((p) => p === "pb" || p === "bp")) return "p-b";
    if (pairs.every((p) => p === "vf" || p === "fv")) return "v-f";
  }
  if (w.length === r.length && sorted(w) === sorted(r)) return "order";

  // Letters left out where English writes a letter it does not say (knife, write, climb, night).
  if (changed.length > 0 && changed.every((d) => d.kind === "missing")) {
    const silent = silentPositions(r);
    let pos = 0;
    let allSilent = true;
    for (const d of diff) {
      if (d.kind === "missing") {
        for (let i = 0; i < d.text.length; i += 1) if (!silent.has(pos + i)) allSilent = false;
      }
      if (d.kind !== "extra") pos += d.kind === "wrong" ? d.expected.length : d.text.length;
    }
    if (allSilent) return "silent";
  }

  const letters = changed.flatMap((d) => [...d.text, ...(d.kind === "wrong" ? d.expected : "")]);
  if (letters.length > 0 && letters.every((c) => VOWELS.has(c))) return "vowel";

  // Only the end differs, and the right word ends in a common ending (-ed, -ing, -ly, plural…).
  const common = commonPrefix(w, r);
  if (common >= Math.max(3, r.length - 4) && ENDINGS_RE.test(r)) return "ending";
  return "other";
}

function commonPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  return i;
}
