/**
 * Splits English text into word tokens with their positions, for the spelling
 * checker. Pure and dictionary-free.
 *
 * - Apostrophes inside a word stay in it (don't, children's); a trailing one
 *   (learners') too. Curly apostrophes count as straight ones.
 * - Hyphenated words are one token (well-known); the checker checks each part.
 * - Chunks with a digit (21st, 3pm, mp3), e-mail addresses, URLs and @handles
 *   produce no tokens: they are never spelling mistakes.
 */

export interface Token {
  /** The word as typed (curly apostrophes straightened). */
  readonly text: string;
  /** Offsets in the original text: text.slice(start, end) is the token. */
  readonly start: number;
  readonly end: number;
  /** First word of a sentence (or of a line): a capital letter says nothing about a name here. */
  readonly sentenceStart: boolean;
  /** Lower-cased word of the previous token in the same sentence (for confusable rules), or null. */
  readonly prev: string | null;
}

const WORD_RE = /[A-Za-z]+(?:['’][A-Za-z]+)*(?:-[A-Za-z]+(?:['’][A-Za-z]+)*)*(?:['’](?![A-Za-z]))?/g;
const SKIP_CHUNK_RE = /\d|@|:\/\/|^www\./i;

/** Abbreviations whose full stop does not end a sentence. */
const ABBREVIATIONS = new Set(["mr", "mrs", "ms", "dr", "st", "prof", "mt", "jr", "sr", "vs", "etc", "e.g", "i.e", "no"]);

export const straighten = (s: string): string => s.replace(/[‘’ʼ`]/g, "'");

export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  let sentenceStart = true;
  let prev: string | null = null;
  // Chunks are runs of non-space characters; sentence boundaries are tracked between them.
  for (const chunk of text.matchAll(/\S+/g)) {
    const raw = chunk[0];
    const base = chunk.index ?? 0;
    const skip = SKIP_CHUNK_RE.test(raw);
    if (!skip) {
      for (const m of raw.matchAll(WORD_RE)) {
        const start = base + (m.index ?? 0);
        const word = straighten(m[0]);
        out.push({ text: word, start, end: start + m[0].length, sentenceStart, prev });
        sentenceStart = false;
        prev = word.toLowerCase();
      }
    } else {
      sentenceStart = false;
      prev = null;
    }
    // A chunk ending in . ! ? (not an abbreviation) ends the sentence; so does a line break after it.
    const lastWord = raw.replace(/[^A-Za-z.]+$/, "").toLowerCase();
    const endsSentence = /[.!?]["')\]]*$/.test(raw) && !ABBREVIATIONS.has(lastWord.replace(/\.$/, ""));
    const gap = /^\s*/.exec(text.slice(base + raw.length))?.[0] ?? "";
    if (endsSentence || gap.includes("\n")) {
      sentenceStart = true;
      prev = null;
    } else if (/[,;:)"\]]$/.test(raw)) {
      // Punctuation separates the words a confusable rule looks at ("your, welcome" is not "your welcome").
      prev = null;
    }
  }
  return out;
}

/** Number of words in a text, the way the length target counts them. */
export const countWords = (text: string): number => tokenize(text).length;
