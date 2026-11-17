import { beforeAll, describe, expect, it } from "vitest";
import { checkText, isMistake, type Speller } from "@/domain/writing/check";
import { compareDictation } from "@/domain/writing/dictation";
import { tokenize } from "@/domain/writing/tokenize";
import { migrateProfileRow } from "@/domain/sync/migrate-profile";
import { mergeRecord } from "@/domain/sync/merge";
import { recordSchemas } from "@/repositories/export";
import { correctedSentence, sentenceWith } from "@/features/writing/use-save-writing";
import { bankWords, ukForms } from "@/features/writing/bank";
import { sameLevels, type ProfileRecord } from "@/domain/model";
import { realSpeller } from "../../helpers/speller";

/** Regressions from the phase E/F code review and test review (DECISIONS G1). */

let speller: Speller;
beforeAll(() => {
  speller = realSpeller();
}, 30_000);

const mistakes = (text: string, accent: "us" | "uk" = "us") =>
  checkText(text, { speller, accent, ukForms, bank: bankWords })
    .issues.filter(isMistake)
    .map((i) => [i.word, i.suggestion]);

describe("confusable rules stay quiet on correct everyday English", () => {
  it.each([
    "Call me when you're home.",
    "I know you're friends.",
    "You're family to me.",
    "Ahmed and Omar? They're friends.",
    "They're family.",
    "OK, see you later then.",
    "I was younger then.",
    "I felt better then.",
    "It went from hot to cold.",
    "I spoke to many.",
    "She asked me to.",
    "In Ramadan we have to fast.",
    "These shoes are not loose.",
    "We all accept the rules.",
    "I invited all of you except Omar.",
    "We live in a quiet small town.",
    "It's quiet right now.",
    "It's way too hot.",
    "You should of course call.",
    "Did they tell you where Ahmed lives?",
    "I'll show you where.",
    "Is there going to be a test?",
  ])("%s", (text) => {
    expect(mistakes(text)).toEqual([]);
  });

  it("still catches the clear cases", () => {
    expect(mistakes("Your welcome.")).toEqual([["Your", "You're"]]);
    expect(mistakes("She is taller then me.")).toEqual([["then", "than"]]);
    expect(mistakes("It is to hot.")).toEqual([["to", "too"]]);
    expect(mistakes("We where late.")).toEqual([["where", "were"]]);
    expect(mistakes("It is quiet good.")).toEqual([["quiet", "quite"]]);
  });
});

describe("names, possessives, loanwords and abbreviations", () => {
  it("does not turn sentence-start names into common words", () => {
    expect(mistakes("Majd is my friend.")).toEqual([]);
    expect(mistakes("Yazan went home.")).toEqual([]);
    expect(mistakes("Tabuk is a city.")).toEqual([]);
    expect(mistakes("Tabuk's weather is hot.")).toEqual([]);
  });

  it("looks names and the learner's own words up without 's", () => {
    expect(mistakes("I met Kareem's brother. Kareem's car is red.")).toEqual([]);
    expect(checkText("We love padel's rules.", { speller, personal: new Set(["padel"]) }).issues.filter(isMistake)).toEqual([]);
    expect(checkText("We visited al-Ahsa.", { speller, personal: new Set(["al-ahsa"]) }).issues.filter(isMistake)).toEqual([]);
  });

  it("keeps accented letters inside one token and does not flag loanwords", () => {
    expect(tokenize("the café, naïve").map((t) => t.text)).toEqual(["the", "café", "naïve"]);
    expect(mistakes("We met at the café. It was naïve.")).toEqual([]);
  });

  it("skips dotted abbreviations and still sees the next sentence", () => {
    expect(mistakes("Bring fruit, e.g. apples. Use a pen, i.e. not a pencil.")).toEqual([]);
    expect(mistakes("I said no. Becuase I was tired.")).toEqual([["Becuase", "Because"]]);
  });

  it("suggests the common word", () => {
    expect(mistakes("I recive emails.")).toEqual([["recive", "receive"]]);
    expect(mistakes("I like teh book.")).toEqual([["teh", "the"]]);
  });
});

describe("British spellings with endings, and British learners", () => {
  it("accepts British forms with 's and irregular British words for an American learner", () => {
    expect(mistakes("My neighbour's car. I love my mum's food. I love maths and I learnt it.")).toEqual([]);
    const notes = checkText("My neighbour's car.", { speller, accent: "us" }).issues;
    expect(notes.map((i) => [i.word, i.suggestion, i.kind])).toEqual([["neighbour's", "neighbor's", "note"]]);
  });

  it("is silent for a British learner, and never asks them to change check, story or program", () => {
    expect(checkText("My neighbour's car.", { speller, accent: "uk", ukForms }).issues).toEqual([]);
    expect(checkText("I will check the story of the computer program.", { speller, accent: "uk", ukForms }).issues).toEqual([]);
  });
});

describe("dictation scoring", () => {
  it("lowers accuracy for extra words", () => {
    const r = compareDictation("Hello world", "Hello world world world");
    expect(r.accuracy).toBeCloseTo(2 / 4);
  });

  it("treats a hyphen and a space the same", () => {
    expect(compareDictation("It is a well-known rule.", "It is a well known rule.").mistakes).toBe(0);
  });

  it("accepts the other spelling variant both ways", () => {
    expect(compareDictation("My colour.", "My color.").mistakes).toBe(0);
    expect(compareDictation("My color.", "My colour.").mistakes).toBe(0);
  });
});

describe("review notes", () => {
  it("matches whole words only and caps the note after the replacement", () => {
    expect(sentenceWith("I had a sandwich. I dont know wich one.", "wich")).toBe("I dont know wich one.");
    expect(correctedSentence("I had a sandwich. I dont know wich one.", "wich", "which")).toBe("I dont know which one.");
    const long = `${"a ".repeat(199)}wich.`;
    expect(correctedSentence(long, "wich", "which").length).toBeLessThanOrEqual(400);
  });
});

describe("profile migration and merge", () => {
  it("treats empty or invalid levels as never set, and repairs the daily goal", () => {
    expect(migrateProfileRow({ id: "me", updatedAt: 1, levels: {} }).levelSource).toBeNull();
    expect(migrateProfileRow({ id: "me", updatedAt: 1, levels: [] }).levelSource).toBeNull();
    for (const bad of [-5, Number.NaN, 1.5, 999]) {
      const out = migrateProfileRow({ id: "me", updatedAt: 1, dailyGoalMinutes: bad, levelsAt: Number.POSITIVE_INFINITY });
      expect(recordSchemas.profile.safeParse(out).success, String(bad)).toBe(true);
    }
  });

  const profile = (over: Partial<ProfileRecord>): ProfileRecord => ({
    id: "me",
    updatedAt: 1,
    levels: sameLevels("A2"),
    levelSource: null,
    levelsAt: 0,
    dailyGoalMinutes: 10,
    ...over,
  });

  it("never lets a newer row without levels wipe chosen levels", () => {
    const chosen = profile({ updatedAt: 5, levels: sameLevels("C1"), levelSource: "placement", levelsAt: 5 });
    const olderClient = profile({ updatedAt: 9, dailyGoalMinutes: 30 });
    const merged = mergeRecord("profile", chosen, olderClient);
    expect(merged).toMatchObject({ dailyGoalMinutes: 30, levels: sameLevels("C1"), levelSource: "placement" });
  });

  it("keeps the later level choice when both devices chose", () => {
    const a = profile({ updatedAt: 10, levels: sameLevels("B1"), levelSource: "choice", levelsAt: 3, dailyGoalMinutes: 20 });
    const b = profile({ updatedAt: 8, levels: sameLevels("C1"), levelSource: "choice", levelsAt: 7 });
    expect(mergeRecord("profile", a, b)).toMatchObject({ dailyGoalMinutes: 20, levels: sameLevels("C1"), levelsAt: 7 });
  });
});
