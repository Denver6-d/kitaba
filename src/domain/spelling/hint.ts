/**
 * The hint every game word shows (DECISIONS M4). A word's own Arabic hint comes
 * first. A word without one gets a fallback: its example sentence with the word
 * hidden, plus the sentence's Arabic translation when Tatoeba links one. The
 * fallback must never give the spelling away, so every form that looks like the
 * word is hidden too ("studies" for "studied", "alright" for "right"), always
 * with the same blank, so the blank does not tell the length either.
 */

export interface HintSource {
  readonly word: string;
  readonly uk?: string | undefined;
  readonly ar?: string | undefined;
  readonly example?: string | undefined;
  readonly exampleAr?: { readonly text: string } | undefined;
}

export type WordHint =
  | { readonly kind: "ar"; readonly text: string }
  | { readonly kind: "sentence"; readonly masked: string; readonly ar?: string | undefined };

/** The blank that replaces the hidden word: always the same, whatever the word's length. */
export const HINT_BLANK = "_____";

const TOKEN = /[A-Za-z]+(?:['’-][A-Za-z]+)*/g;

function commonPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  return i;
}

/** The word without a final y, e, fe or f, so "city" / "cities" and "knife" / "knives" meet. */
const stem = (w: string): string => w.replace(/(fe|[yef])$/, "");

function longestCommonRun(a: string, b: string): number {
  let best = 0;
  for (let i = 0; i < a.length; i += 1)
    for (let j = 0; j < b.length; j += 1) {
      let k = 0;
      while (i + k < a.length && j + k < b.length && a[i + k] === b[j + k]) k += 1;
      if (k > best) best = k;
    }
  return best;
}

/**
 * Whether a token of the sentence would show (part of) the spelling of `target`. It errs on
 * the side of hiding: a hidden extra word costs little, a shown spelling spoils the test.
 */
export function looksLike(token: string, target: string): boolean {
  const t = token.toLowerCase().replace(/’/g, "'").replace(/-/g, "");
  const w = target.toLowerCase().replace(/-/g, "");
  if (t === w) return true;
  // Very short words: only their own inflections ("go" / "goes", "do" / "doing").
  if (w.length < 3) return t.startsWith(w) && t.length <= w.length + 3;
  // A form that contains the word ("alright", "rights") or a 4+ letter part of it.
  if (t.includes(w)) return true;
  if (t.length >= 4 && w.includes(t)) return true;
  // Relatives: a shared start of 4+ letters ("powerful" / "powerless", "singing" / "singers"),
  // or the word's stem ("cities" / "city", "knives" / "knife").
  if (commonPrefix(t, w) >= 4) return true;
  const s = stem(w);
  if (s.length >= 3 && t.startsWith(s)) return true;
  // A long shared run anywhere ("disbelief" / "believe" share "belie").
  return longestCommonRun(t, w) >= 5;
}

/**
 * The sentence with every form of the word (and its British spelling) replaced by
 * one fixed blank, or null when the word is not in it (then it is no hint).
 */
export function hideWordIn(sentence: string, word: string, uk?: string): string | null {
  const targets = uk && uk !== word ? [word, uk] : [word];
  let hidden = false;
  const masked = sentence.replace(TOKEN, (tok) => {
    if (!targets.some((w) => looksLike(tok, w))) return tok;
    hidden = true;
    return HINT_BLANK;
  });
  return hidden ? masked : null;
}

/** The hint to show for a word, or null when it has neither an Arabic hint nor a usable example. */
export function hintFor(w: HintSource): WordHint | null {
  if (w.ar) return { kind: "ar", text: w.ar };
  if (!w.example) return null;
  const masked = hideWordIn(w.example, w.word, w.uk);
  if (masked === null) return null;
  return w.exampleAr ? { kind: "sentence", masked, ar: w.exampleAr.text } : { kind: "sentence", masked };
}

const kinds = new WeakMap<HintSource, "ar" | "fallback" | null>();

/** "ar" for a word with its own Arabic hint, "fallback" for an example-based hint, null for none. Memoised per word object. */
export function hintKind(w: HintSource): "ar" | "fallback" | null {
  const known = kinds.get(w);
  if (known !== undefined) return known;
  const h = hintFor(w);
  const k = h === null ? null : h.kind === "ar" ? "ar" : "fallback";
  kinds.set(w, k);
  return k;
}
