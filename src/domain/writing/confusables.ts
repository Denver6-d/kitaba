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
/** Nouns that cannot follow "you are"/"they are" in normal English ("you're home", "they're friends" and "you're family" are fine, so those are not here). */
const NOUN_AFTER_POSSESSIVE = set("own", "car", "house", "name", "names", "phone", "mother", "father", "book", "books", "job", "email", "bag", "room", "address", "parents", "brother", "sister", "birthday", "help");
const BE_FORMS = set("is", "are", "was", "were");
const AFTER_THEYRE = set("going", "coming", "doing", "being", "getting", "not", "always");
const AFTER_ITS_CONTRACTION = set("a", "an", "the", "not", "been", "going", "raining", "important", "difficult", "easy", "nice", "cold", "hot", "late", "time", "my", "your", "true", "ok", "okay", "possible", "impossible", "necessary");
// "fast" and "slow" are left out ("we have to fast"), as is "many" ("I spoke to many").
const TOO_ADJ = set("much", "late", "early", "hot", "cold", "big", "small", "expensive", "difficult", "hard", "busy", "tired", "far", "long", "loud", "heavy");
const COMPARATIVE_WORDS = set("more", "less", "better", "worse", "rather", "other", "fewer");
const MODALS_TO_LOSE = set("to", "will", "might", "could", "would", "don't", "didn't", "can't", "won't", "may");
const MODALS_TO_AFFECT = set("will", "can", "may", "might", "could", "would", "does", "did", "not", "to");
const DET = set("the", "an", "no", "any", "positive", "negative", "side");
const TO_ACCEPT = set("i", "we", "they", "to", "will", "please", "cannot", "can't", "don't", "didn't", "would");
const ALL_WORDS = set("everyone", "everything", "everybody", "nobody");
const QUITE_NEXT = set("good", "well", "difficult", "easy", "a", "nice", "hard", "sure", "often", "expensive", "different", "interesting", "tired", "busy", "happy");
/** "quiet" is only read as "quite" right after a form of "be" ("it is quiet good"), never before a noun ("a quiet small town"). */
const BE_BEFORE_QUITE = set("is", "was", "are", "were", "it's", "that's", "he's", "she's", "i'm", "you're", "we're", "they're", "not");
const QUIET_PREV = set("very", "keep", "so", "too", "stay", "be", "really");
const WH_NEXT = set("is", "are", "do", "does", "did", "can", "was");
const WERE_PREV = set("we", "they", "you");
/** "we where late": only these words after "where" make it clearly "were" ("tell you where Ahmed lives" stays). */
const AFTER_WERE = set("late", "happy", "here", "there", "going", "not", "very", "so", "tired", "busy", "ready", "right", "wrong", "all", "both", "at", "in");
const MODAL_OF = set("could", "would", "should", "must", "might");
const COMPARATIVES = set(
  "bigger", "smaller", "older", "younger", "faster", "slower", "higher", "lower", "easier", "harder", "cheaper", "longer", "shorter",
  "taller", "happier", "warmer", "colder", "hotter", "nicer", "larger", "stronger", "weaker", "richer", "closer",
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
      if (c.next && AFTER_THEYRE.has(c.next) && c.next !== "not" && c.next !== "always" && !(c.prev && NOT_BEFORE_THEIR.has(c.prev)))
        return { suggestion: "they're", pair: "their-there-theyre" };
      return null;
    case "they're":
      if (c.next && NOUN_AFTER_POSSESSIVE.has(c.next)) return { suggestion: "their", pair: "their-there-theyre" };
      if (c.next && BE_FORMS.has(c.next)) return { suggestion: "there", pair: "their-there-theyre" };
      return null;
    case "its":
      if (c.next && AFTER_ITS_CONTRACTION.has(c.next)) return { suggestion: "it's", pair: "its-its" };
      return null;
    case "it's":
      if (c.next && set("own", "name", "color", "colour", "size", "price", "tail", "owner").has(c.next)) return { suggestion: "its", pair: "its-its" };
      return null;
    case "to":
      // "from hot to cold" is right: the word before is an adjective of the same kind.
      if (c.next && TOO_ADJ.has(c.next) && (c.next2 === null || c.next2 === "for" || c.next2 === "to") && !(c.prev && (TOO_ADJ.has(c.prev) || c.prev === "from")))
        return { suggestion: "too", pair: "to-too" };
      return null;
    case "then":
      // "I was younger then." is right ("at that time"): only "then" followed by what is compared counts.
      if (c.prev && isComparative(c.prev) && !c.clauseEnd) return { suggestion: "than", pair: "then-than" };
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
      if (c.next && QUITE_NEXT.has(c.next) && c.prev && BE_BEFORE_QUITE.has(c.prev)) return { suggestion: "quite", pair: "quite-quiet" };
      return null;
    case "quite":
      if (c.prev && QUIET_PREV.has(c.prev) && (c.clauseEnd || c.next === "please")) return { suggestion: "quiet", pair: "quite-quiet" };
      return null;
    case "were":
      if (c.prev === null && c.next && WH_NEXT.has(c.next)) return { suggestion: "where", pair: "were-where" };
      return null;
    case "where":
      if (c.prev && WERE_PREV.has(c.prev) && c.next && AFTER_WERE.has(c.next)) return { suggestion: "were", pair: "were-where" };
      return null;
    case "of":
      if (c.prev && MODAL_OF.has(c.prev) && c.next !== "course") return { suggestion: "have", pair: "of-have" };
      return null;
    default:
      return null;
  }
}
