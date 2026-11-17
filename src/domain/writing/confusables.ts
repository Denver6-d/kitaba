/**
 * Common confusables (rule-based, DECISIONS F4). Each rule looks only at the
 * word itself and its direct neighbours in the same clause, and only fires on
 * patterns that are wrong in practically every context ("your welcome",
 * "more then", "could of"). It is not grammar checking: anything ambiguous is
 * left alone, so the rules stay quiet rather than wrong.
 */

export interface ConfusableHit {
  /** The replacement, in lower case (the checker restores a leading capital). */
  readonly suggestion: string;
  /** Which pair, for the explanation (e.g. "your-youre"). */
  readonly pair: ConfusablePair;
}

export type ConfusablePair =
  | "your-youre"
  | "their-there-theyre"
  | "its-its"
  | "to-too"
  | "then-than"
  | "lose-loose"
  | "affect-effect"
  | "accept-except"
  | "quite-quiet"
  | "were-where"
  | "of-have";

export interface ConfusableContext {
  /** Lower-cased words: the one before (same clause) and the one after (same clause), or null. */
  readonly prev: string | null;
  readonly next: string | null;
  /** The word after `next` (same clause), or null. */
  readonly next2: string | null;
  /** True when the clause ends right after this word (punctuation or end of text). */
  readonly clauseEnd: boolean;
}

const set = (...w: string[]) => new Set(w);

const AFTER_YOURE = set("welcome", "going", "coming", "doing", "being", "getting", "not", "always", "still");
const NOUN_AFTER_POSSESSIVE = set("own", "car", "house", "home", "name", "names", "phone", "friend", "friends", "family", "mother", "father", "children", "book", "books", "job", "email", "bag", "room", "work", "address", "help", "money", "parents");
const BE_FORMS = set("is", "are", "was", "were");
const AFTER_THEYRE = set("going", "coming", "doing", "being", "getting", "not", "always");
const AFTER_ITS_CONTRACTION = set("a", "an", "the", "not", "been", "going", "raining", "important", "difficult", "easy", "nice", "cold", "hot", "late", "time", "my", "your", "true", "ok", "okay", "possible", "impossible", "necessary");
const TOO_ADJ = set("much", "many", "late", "early", "hot", "cold", "big", "small", "expensive", "difficult", "hard", "busy", "tired", "far", "long", "fast", "slow", "loud", "heavy");
const COMPARATIVE_WORDS = set("more", "less", "better", "worse", "rather", "other", "fewer");
const MODALS_TO_LOSE = set("to", "will", "might", "could", "would", "don't", "didn't", "not", "never", "can't", "won't", "may");
const MODALS_TO_AFFECT = set("will", "can", "may", "might", "could", "would", "does", "did", "not", "to");
const DET = set("the", "an", "no", "any", "positive", "negative", "side");
const TO_ACCEPT = set("i", "we", "they", "you", "to", "will", "please", "cannot", "can't", "don't", "not", "didn't", "would");
const ALL_WORDS = set("everyone", "everything", "everybody", "all", "nobody", "anyone");
const QUITE_NEXT = set("good", "well", "difficult", "easy", "a", "nice", "hard", "sure", "often", "big", "small", "expensive", "long", "different", "right", "interesting", "tired", "busy", "happy", "far", "close");
const QUIET_PREV = set("very", "keep", "so", "too", "stay", "be", "really");
const WH_NEXT = set("is", "are", "do", "does", "did", "can", "was");
const WERE_PREV = set("we", "they", "you");
const MODAL_OF = set("could", "would", "should", "must", "might");
const COMPARATIVES = set(
  "bigger", "smaller", "older", "younger", "faster", "slower", "higher", "lower", "easier", "harder", "cheaper", "longer", "shorter",
  "taller", "earlier", "later", "happier", "warmer", "colder", "hotter", "nicer", "larger", "stronger", "weaker", "richer", "closer",
  "greater", "smarter", "quicker", "safer", "busier", "heavier", "lighter", "louder", "quieter", "wider", "deeper", "worse", "better",
);
/** Only a known comparative before "then" counts: many nouns also end in -er ("open the folder then click"). */
const isComparative = (w: string) => COMPARATIVE_WORDS.has(w) || COMPARATIVES.has(w);
const NOT_BEFORE_THEIR = set("is", "are", "was", "were", "isn't", "aren't", "wasn't", "weren't", "over", "here");

/** Checks one word (lower case) in its context. Returns a fix, or null. */
export function confusableFix(word: string, c: ConfusableContext): ConfusableHit | null {
  switch (word) {
    case "your":
      if (c.next && AFTER_YOURE.has(c.next)) return { suggestion: "you're", pair: "your-youre" };
      if (c.next === "the" && c.next2 === "best") return { suggestion: "you're", pair: "your-youre" };
      return null;
    case "you're":
      if (c.next && NOUN_AFTER_POSSESSIVE.has(c.next)) return { suggestion: "your", pair: "your-youre" };
      return null;
    case "their":
      if (c.next && BE_FORMS.has(c.next)) return { suggestion: "there", pair: "their-there-theyre" };
      if (c.next && AFTER_THEYRE.has(c.next)) return { suggestion: "they're", pair: "their-there-theyre" };
      return null;
    case "there":
      // "Are there books?" is right: only flag when "there" does not follow a form of "be".
      if (c.next && NOUN_AFTER_POSSESSIVE.has(c.next) && !set("work", "help", "home").has(c.next) && !(c.prev && NOT_BEFORE_THEIR.has(c.prev)))
        return { suggestion: "their", pair: "their-there-theyre" };
      if (c.next && AFTER_THEYRE.has(c.next) && c.next !== "not" && c.next !== "always") return { suggestion: "they're", pair: "their-there-theyre" };
      return null;
    case "they're":
      if (c.next && NOUN_AFTER_POSSESSIVE.has(c.next)) return { suggestion: "their", pair: "their-there-theyre" };
      if (c.next && BE_FORMS.has(c.next)) return { suggestion: "there", pair: "their-there-theyre" };
      return null;
    case "its":
      if (c.next && AFTER_ITS_CONTRACTION.has(c.next)) return { suggestion: "it's", pair: "its-its" };
      return null;
    case "it's":
      if (c.next && set("own", "name", "color", "colour", "size", "price", "way", "tail", "owner").has(c.next)) return { suggestion: "its", pair: "its-its" };
      return null;
    case "to":
      if (c.next && TOO_ADJ.has(c.next) && (c.next2 === null || c.next2 === "for" || c.next2 === "to")) return { suggestion: "too", pair: "to-too" };
      if (c.clauseEnd && c.prev !== null && set("me", "us").has(c.prev)) return { suggestion: "too", pair: "to-too" };
      return null;
    case "then":
      if (c.prev && isComparative(c.prev)) return { suggestion: "than", pair: "then-than" };
      return null;
    case "than":
      if (c.prev && set("and", "since", "until", "just", "only", "back").has(c.prev)) return { suggestion: "then", pair: "then-than" };
      return null;
    case "loose":
      if (c.prev && MODALS_TO_LOSE.has(c.prev)) return { suggestion: "lose", pair: "lose-loose" };
      return null;
    case "affect":
      // A noun position ("the affect", "a big affect") or "affect on/of" is always the noun "effect".
      if ((c.prev && DET.has(c.prev)) || c.next === "on" || c.next === "of") return { suggestion: "effect", pair: "affect-effect" };
      return null;
    case "effect":
      if (c.prev && MODALS_TO_AFFECT.has(c.prev) && c.prev !== "to") return { suggestion: "affect", pair: "affect-effect" };
      return null;
    case "except":
      if (c.prev && TO_ACCEPT.has(c.prev)) return { suggestion: "accept", pair: "accept-except" };
      return null;
    case "accept":
      if (c.prev && ALL_WORDS.has(c.prev)) return { suggestion: "except", pair: "accept-except" };
      return null;
    case "quiet":
      if (c.next && QUITE_NEXT.has(c.next) && c.prev !== "be" && c.prev !== "keep") return { suggestion: "quite", pair: "quite-quiet" };
      return null;
    case "quite":
      if (c.prev && QUIET_PREV.has(c.prev) && (c.clauseEnd || c.next === "please")) return { suggestion: "quiet", pair: "quite-quiet" };
      return null;
    case "were":
      if (c.prev === null && c.next && WH_NEXT.has(c.next)) return { suggestion: "where", pair: "were-where" };
      return null;
    case "where":
      if (c.prev && WERE_PREV.has(c.prev) && !(c.next && set("to", "you", "we", "they", "i", "he", "she", "it", "the", "a", "my", "your", "our", "is", "are").has(c.next))) return { suggestion: "were", pair: "were-where" };
      return null;
    case "of":
      if (c.prev && MODAL_OF.has(c.prev)) return { suggestion: "have", pair: "of-have" };
      return null;
    default:
      return null;
  }
}
