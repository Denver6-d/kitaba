/**
 * Public nickname rules. The same rules (and the same blocked-word list) are
 * enforced again by set_leaderboard_nickname() in SQL; a test keeps both in sync.
 * The filter is deliberately basic: it catches common words, not every insult.
 */

export type NicknameError = "length" | "chars" | "blocked";
export type NicknameResult = { ok: true; value: string } | { ok: false; error: NicknameError };

export const NICKNAME_MIN = 3;
export const NICKNAME_MAX = 20;

/** Latin letters, digits, space, _ and -, plus the Arabic letters ء–ي. */
const ALLOWED = /^[A-Za-z0-9 _\-ء-ي]+$/;

/** Normalised (lower-case, de-leeted, separators removed). Matched as substrings. */
export const BLOCKED_WORDS: readonly string[] = [
  // reserved
  "admin",
  "kitaba",
  "moderator",
  "support",
  "official",
  // English profanity and slurs (basic list)
  "fuck",
  "shit",
  "bitch",
  "cunt",
  "dick",
  "pussy",
  "asshole",
  "bastard",
  "whore",
  "slut",
  "nigger",
  "nigga",
  "faggot",
  "retard",
  "hitler",
  "porn",
  // Arabic insults (basic list)
  "شرموط",
  "قحبة",
  "منيوك",
  "عرص",
  "خول",
  "كلب",
  "حمار",
  "زبالة",
];

const LEET: Readonly<Record<string, string>> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s", "!": "i" };

/**
 * Arabic spelling variants folded to one letter, and the tatweel (U+0640, a
 * stretching mark inside the allowed range ء–ي) dropped, so "كـلب" or "قحبه"
 * cannot slip past the list (DECISIONS SEC3). Same table as the SQL translate().
 */
const ARABIC_FOLD: Readonly<Record<string, string>> = { "\u0629": "\u0647", "\u0623": "\u0627", "\u0625": "\u0627", "\u0622": "\u0627", "\u0649": "\u064A", "\u0640": "" };

export function normalizeForFilter(raw: string): string {
  return [...raw.toLowerCase()]
    .map((c) => LEET[c] ?? ARABIC_FOLD[c] ?? c)
    .join("")
    .replace(/[^a-zء-ي]/g, "");
}

/** The blocked list in the same normalised form, so "قحبة" in the list also matches "قحبه". */
const BLOCKED_NORMALIZED: readonly string[] = BLOCKED_WORDS.map(normalizeForFilter);

export function validateNickname(raw: string): NicknameResult {
  const value = raw.trim().replace(/\s+/g, " ");
  const length = [...value].length;
  if (length < NICKNAME_MIN || length > NICKNAME_MAX) return { ok: false, error: "length" };
  if (!ALLOWED.test(value)) return { ok: false, error: "chars" };
  const norm = normalizeForFilter(value);
  if (BLOCKED_NORMALIZED.some((w) => norm.includes(w))) return { ok: false, error: "blocked" };
  return { ok: true, value };
}
