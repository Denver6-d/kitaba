/**
 * Normalization for comparing an answer with the accepted answers.
 * Case, punctuation, curly quotes, spacing and contractions are not graded:
 * "I'm" and "I am" are the same answer.
 */

const NUMBERS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

/** Contractions written without the apostrophe (a common learner slip). Only non-words are listed. */
export const APOSTROPHE_LESS: Readonly<Record<string, string>> = {
  dont: "do not",
  doesnt: "does not",
  didnt: "did not",
  cant: "cannot",
  isnt: "is not",
  arent: "are not",
  wasnt: "was not",
  werent: "were not",
  havent: "have not",
  hasnt: "has not",
  wouldnt: "would not",
  couldnt: "could not",
  shouldnt: "should not",
  im: "i am",
  ive: "i have",
  youre: "you are",
  theyre: "they are",
  thats: "that is",
  whats: "what is",
};

const IS_CONTRACTIONS = new Set(["it", "that", "what", "there", "he", "she", "where", "who", "here", "how"]);

function expandToken(token: string): string {
  if (token === "can't") return "cannot";
  if (token === "won't") return "will not";
  if (token === "shan't") return "shall not";
  if (token === "let's") return "let us";
  const nt = /^([a-z]+)n't$/.exec(token);
  if (nt?.[1]) return `${nt[1]} not`;
  const m = /^([a-z]+)'(m|re|ve|ll|d|s)$/.exec(token);
  if (m?.[1] && m[2]) {
    const [, head, tail] = m;
    switch (tail) {
      case "m":
        return `${head} am`;
      case "re":
        return `${head} are`;
      case "ve":
        return `${head} have`;
      case "ll":
        return `${head} will`;
      case "d":
        return `${head} would`;
      case "s":
        return IS_CONTRACTIONS.has(head) ? `${head} is` : token; // otherwise possessive
    }
  }
  const bare = APOSTROPHE_LESS[token];
  if (bare) return bare;
  const n = /^\d+$/.test(token) ? NUMBERS[Number(token)] : undefined;
  return n ?? token;
}

export function normalize(input: string): string {
  const cleaned = input
    .toLowerCase()
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ");
  const tokens = cleaned
    .split(/\s+/)
    .map((t) => t.replace(/^'+|'+$/g, ""))
    .filter((t) => t.length > 0)
    .map(expandToken)
    .join(" ")
    .replace(/\bcan not\b/g, "cannot");
  return tokens.trim();
}

export function tokenize(input: string): string[] {
  const n = normalize(input);
  return n === "" ? [] : n.split(" ");
}
