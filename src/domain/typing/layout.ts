/**
 * Keyboard-layout helpers. Pure: no DOM access.
 *
 * Arabic speakers often switch between the Arabic and US layouts (Alt+Shift on
 * Windows). When the Arabic layout is still active during an English test, the
 * browser reports Arabic characters in `event.key`, but `event.code` still
 * names the physical key, which tells us what the learner meant to type.
 */

const ARABIC_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0600, 0x06ff], // Arabic
  [0x0750, 0x077f], // Arabic Supplement
  [0x08a0, 0x08ff], // Arabic Extended-A
  [0xfb50, 0xfdff], // Presentation Forms-A
  [0xfe70, 0xfeff], // Presentation Forms-B
];

export function isArabicChar(ch: string): boolean {
  const cp = ch.codePointAt(0);
  if (cp === undefined) return false;
  return ARABIC_RANGES.some(([lo, hi]) => cp >= lo && cp <= hi);
}

/** Printable ASCII (space through tilde): the characters our English content uses. */
export function isLatinTypable(ch: string): boolean {
  if (ch.length !== 1) return false;
  const cp = ch.charCodeAt(0);
  return cp >= 0x20 && cp <= 0x7e;
}

const SHIFTED_DIGITS = [")", "!", "@", "#", "$", "%", "^", "&", "*", "("] as const;

const PUNCTUATION: Readonly<Record<string, readonly [string, string]>> = {
  Space: [" ", " "],
  Minus: ["-", "_"],
  Equal: ["=", "+"],
  BracketLeft: ["[", "{"],
  BracketRight: ["]", "}"],
  Backslash: ["\\", "|"],
  Semicolon: [";", ":"],
  Quote: ["'", '"'],
  Backquote: ["`", "~"],
  Comma: [",", "<"],
  Period: [".", ">"],
  Slash: ["/", "?"],
};

/** Physical key code (KeyboardEvent.code) → character on a US QWERTY layout. */
export function codeToLatin(code: string, shift: boolean): string | null {
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter?.[1]) return shift ? letter[1] : letter[1].toLowerCase();
  const digit = /^Digit([0-9])$/.exec(code);
  if (digit?.[1]) {
    const n = Number(digit[1]);
    return shift ? (SHIFTED_DIGITS[n] ?? null) : digit[1];
  }
  const p = PUNCTUATION[code];
  if (p) return shift ? p[1] : p[0];
  return null;
}

/**
 * Standard Arabic (101) layout → the US key at the same physical position.
 * Used when `event.code` is missing (many mobile keyboards).
 */
const ARABIC_101: Readonly<Record<string, string>> = {
  "ذ": "`",
  "ض": "q", "ص": "w", "ث": "e", "ق": "r", "ف": "t", "غ": "y", "ع": "u", "ه": "i", "خ": "o", "ح": "p", "ج": "[", "د": "]",
  "ش": "a", "س": "s", "ي": "d", "ب": "f", "ل": "g", "ا": "h", "ت": "j", "ن": "k", "م": "l", "ك": ";", "ط": "'",
  "ئ": "z", "ء": "x", "ؤ": "c", "ر": "v", "ﻻ": "b", "ى": "n", "ة": "m", "و": ",", "ز": ".", "ظ": "/",
  "،": ",", "؟": "?", "؛": ";",
};

export function arabicCharToLatin(ch: string): string | null {
  return ARABIC_101[ch] ?? null;
}

/** Best guess at the Latin character the learner intended to type. */
export function intendedLatin(char: string, code: string | undefined, shift: boolean): string | null {
  if (code) {
    const fromCode = codeToLatin(code, shift);
    if (fromCode !== null) return fromCode;
  }
  const fromMap = arabicCharToLatin(char);
  if (fromMap === null) return null;
  return shift && /[a-z]/.test(fromMap) ? fromMap.toUpperCase() : fromMap;
}

/** US key → the Arabic (101) letter on the same physical key (for on-screen keyboard labels). */
export function arabicOnKey(latin: string): string | null {
  const lower = latin.toLowerCase();
  for (const [ar, key] of Object.entries(ARABIC_101)) {
    if (key === lower && ar.length === 1 && !"،؟؛".includes(ar)) return ar;
  }
  return null;
}
