import { beforeAll, describe, expect, it } from "vitest";
import { checkText, isMistake, twoSlipSuggestion, vowelOrDoubleSlips, type Speller } from "@/domain/writing/check";
import { bankWords } from "@/features/writing/bank";
import { tokenize } from "@/domain/writing/tokenize";
import { realSpeller } from "../../helpers/speller";

let speller: Speller;
beforeAll(() => {
  speller = realSpeller();
}, 30_000);

const issuesOf = (text: string, opts: Partial<Parameters<typeof checkText>[1]> = {}) => checkText(text, { speller, ...opts }).issues;
const mistakes = (text: string, opts: Partial<Parameters<typeof checkText>[1]> = {}) =>
  issuesOf(text, opts)
    .filter(isMistake)
    .map((i) => [i.word, i.suggestion, i.type]);

describe("tokenize", () => {
  it("keeps apostrophes and hyphens inside words and records offsets", () => {
    const text = "I don't know the well-known learners' rules.";
    const t = tokenize(text);
    expect(t.map((x) => x.text)).toEqual(["I", "don't", "know", "the", "well-known", "learners'", "rules"]);
    for (const x of t) expect(text.slice(x.start, x.end).replace(/’/g, "'")).toBe(x.text);
  });

  it("straightens curly apostrophes", () => {
    expect(tokenize("It’s fine").map((x) => x.text)).toEqual(["It's", "fine"]);
  });

  it("skips numbers, ordinals, times, emails and URLs", () => {
    expect(tokenize("Call me at 3pm on the 21st, email sara@example.com or see www.example.com and https://x.org 2024.").map((x) => x.text)).toEqual([
      "Call",
      "me",
      "at",
      "on",
      "the",
      "email",
      "or",
      "see",
      "and",
    ]);
  });

  it("marks sentence starts after . ! ? and line breaks, but not after Mr. or Dr.", () => {
    const t = tokenize("Hi Sam.\nDear Dr. Saleh, thanks! See you");
    expect(t.filter((x) => x.sentenceStart).map((x) => x.text)).toEqual(["Hi", "Dear", "See"]);
  });
});

describe("checkText: known misspellings", () => {
  it.each([
    ["I recieve many emails.", "recieve", "receive", "ie-ei"],
    ["It is neccessary to rest.", "neccessary", "necessary", "double"],
    ["See you tomorow.", "tomorow", "tomorrow", "double"],
    ["The goverment decided.", "goverment", "government", "silent"],
    ["I have a sore nee.", null, null, null],
    ["I like vegetables and brobLems", null, null, null],
  ])("%s", (text, wrong, right, type) => {
    const found = mistakes(text);
    if (wrong === null) return;
    expect(found).toContainEqual([wrong, right, type]);
  });

  it("finds every mistake in a short message and keeps their positions", () => {
    const text = "Dear Ahmed, I beleive the meeting is on Wensday. Thank you for you're help.";
    const found = issuesOf(text).filter(isMistake);
    expect(found.map((i) => i.word)).toEqual(["beleive", "Wensday", "you're"]);
    for (const i of found) expect(text.slice(i.start, i.end)).toBe(i.word);
    expect(found[0]?.suggestion).toBe("believe");
    expect(found[1]?.suggestion).toBe("Wednesday");
    expect(found[2]).toMatchObject({ kind: "confusable", suggestion: "your", pair: "your-youre" });
  });

  it("flags a lower-case i and a lower-case day name as capital mistakes", () => {
    expect(mistakes("Yesterday i went home on monday.")).toEqual([
      ["i", "I", "capital"],
      ["monday", "Monday", "capital"],
    ]);
  });

  it("explains a missing apostrophe and a word written as one", () => {
    expect(mistakes("I dont have alot of time.")).toEqual([
      ["dont", "don't", "apostrophe"],
      ["alot", "a lot", "split"],
    ]);
  });

  it("checks each part of a hyphenated word", () => {
    expect(mistakes("It is a well-knwon rule and a twenty-one day trip.")).toEqual([["well-knwon", "well-known", expect.any(String)]]);
  });

  it.each([
    ["prestegeous", "prestigious"],
    ["sepperate", "separate"],
    ["definately", "definitely"],
    ["ocasionaly", "occasionally"],
    ["seperate", "separate"],
    ["existance", "existence"],
    ["independant", "independent"],
    ["wierd", "weird"],
  ])("suggests the common word for %s, even two vowel or double-letter slips away", (wrong, right) => {
    expect(issuesOf(`I think it is ${wrong} here.`, { bank: bankWords }).map((i) => [i.word, i.suggestion])).toEqual([[wrong, right]]);
  });

  it("corrects every word of a paragraph with one- and two-slip mistakes (regression: prestegeous had no suggestion)", () => {
    const text = "Real discpline is prestegeous, and knowlege grows when you endevor every day.";
    expect(mistakes(text, { bank: bankWords }).map(([w, s]) => [w, s])).toEqual([
      ["discpline", "discipline"],
      ["prestegeous", "prestigious"],
      ["knowlege", "knowledge"],
      ["endevor", "endeavor"],
    ]);
  });

  it("names p/b and v/f confusions", () => {
    expect(mistakes("I have a broblem.")).toContainEqual(["broblem", "problem", "p-b"]);
    expect(mistakes("I like fery much.")).toContainEqual(["fery", "very", "v-f"]);
  });
});

describe("checkText: confusables (rule-based)", () => {
  it.each([
    ["Your welcome.", "Your", "You're"],
    ["Their is a problem.", "Their", "There"],
    ["I visited there house.", "there", "their"],
    ["Its a nice day.", "Its", "It's"],
    ["The dog wagged it's tail.", "it's", "its"],
    ["It is to hot.", "to", "too"],
    ["She is taller then me.", "then", "than"],
    ["I don't want to loose my keys.", "loose", "lose"],
    ["It had a big affect on me.", "affect", "effect"],
    ["I could of come.", "of", "have"],
    ["Please be quite.", "quite", "quiet"],
    ["Everyone accept Sara came.", "accept", "except"],
  ])("%s", (text, wrong, right) => {
    expect(issuesOf(text).filter((i) => i.kind === "confusable").map((i) => [i.word, i.suggestion])).toEqual([[wrong, right]]);
  });

  it("stays quiet on correct uses", () => {
    for (const text of [
      "You're welcome.",
      "There is a problem.",
      "Are there books on the table?",
      "Their house is big.",
      "It's a nice day.",
      "The company changed its name.",
      "It is too hot.",
      "I want to go too.",
      "Open the folder then click the button.",
      "First we ate, then we walked.",
      "I don't want to lose my keys.",
      "These shoes are loose.",
      "The weather can affect your mood.",
      "I could have come.",
      "It is quite cold.",
      "The room is quiet.",
      "I accept your offer.",
      "Everyone except Sara came.",
      "Tell you where to go.",
      "We were late.",
      "Your very own room is ready.",
    ]) {
      expect(issuesOf(text).filter(isMistake), text).toEqual([]);
    }
  });
});

describe("checkText: no false positives", () => {
  it("does not flag names in the middle of a sentence, or common Arabic names at the start", () => {
    expect(mistakes("Yesterday I met Kareem and Zarqa in Irbid with Mr. Haddad.")).toEqual([]);
    expect(mistakes("Omar is my brother. Layla lives in Riyadh.")).toEqual([]);
  });

  it("treats a capitalised unknown word that is used as a name elsewhere as a name", () => {
    expect(mistakes("Zaynab called. I met Zaynab later.")).toEqual([]);
  });

  it("does not flag numbers, acronyms, ordinals, contractions or plural possessives", () => {
    expect(mistakes("The NASA team met 3 times on the 21st at 10:30, didn't they? The learners' books are here, and so is the BBC.")).toEqual([]);
  });

  it("accepts the learner's own dictionary", () => {
    expect(mistakes("I study at Kitabaa school.")).toEqual([]);
    expect(mistakes("we play padel.", { personal: new Set(["padel"]) })).toEqual([]);
  });

  it("flags a misspelled first word when a close real word exists", () => {
    expect(mistakes("Recieve the parcel today.")).toEqual([["Recieve", "Receive", "ie-ei"]]);
  });
});

describe("checkText: British and American spelling", () => {
  it("accepts British spellings with a note for an American learner, never as a mistake", () => {
    const found = issuesOf("My favourite colour is grey, and I travelled to the centre.", { accent: "us" });
    expect(found.filter(isMistake)).toEqual([]);
    expect(found.map((i) => [i.word, i.suggestion, i.kind])).toEqual([
      ["favourite", "favorite", "note"],
      ["colour", "color", "note"],
      ["grey", "gray", "note"],
      ["travelled", "traveled", "note"],
      ["centre", "center", "note"],
    ]);
  });

  it("accepts British spellings silently for a British learner, and notes American ones", () => {
    const uk = new Map([["color", "colour"]]);
    expect(issuesOf("My favourite colour.", { accent: "uk", ukForms: uk })).toEqual([]);
    expect(issuesOf("My color.", { accent: "uk", ukForms: uk }).map((i) => [i.word, i.suggestion, i.kind])).toEqual([["color", "colour", "note"]]);
  });

  it("counts words, names and numbers aside", () => {
    expect(checkText("I have 2 cats and one dog.", { speller }).words).toBe(6);
  });
});

describe("two-slip suggestions", () => {
  it("lists one vowel or double-letter slip at a time", () => {
    const slips = vowelOrDoubleSlips("sepet");
    expect(slips).toContain("sapet"); // vowel swapped
    expect(slips).toContain("seppet"); // consonant doubled
    expect(vowelOrDoubleSlips("sepped")).toContain("seped"); // consonant undoubled
    expect(slips).not.toContain("sepet");
  });

  it("returns the one word two slips away, preferring a bank word, and nothing when it cannot choose", () => {
    const words = new Set(["prestigious", "separate", "suppurate"]);
    const isWord = (w: string) => words.has(w);
    expect(twoSlipSuggestion("prestegeous", isWord)).toBe("prestigious");
    expect(twoSlipSuggestion("sepperate", isWord)).toBeNull(); // separate or suppurate
    expect(twoSlipSuggestion("sepperate", isWord, new Set(["separate"]))).toBe("separate");
  });

  it("leaves short words, capitalised words and words with other letters alone", () => {
    const isWord = () => true;
    expect(twoSlipSuggestion("abcde", isWord)).toBeNull();
    expect(twoSlipSuggestion("Prestegeous", isWord)).toBeNull();
    expect(twoSlipSuggestion("don'tt", isWord)).toBeNull();
  });
});
