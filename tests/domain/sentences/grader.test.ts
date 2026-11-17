import { describe, expect, it } from "vitest";
import { normalize, tokenize } from "@/domain/sentences/normalize";
import { alignTokens } from "@/domain/sentences/align";
import { gradeSentence, type ErrorType } from "@/domain/sentences/grader";
import { charDistance, sameBase } from "@/domain/sentences/classify";

const types = (input: string, accepted: string[]): ErrorType[] =>
  gradeSentence(input, accepted).errors.map((e) => e.type);

describe("normalize", () => {
  it.each([
    ["Hello, World!", "hello world"],
    ["  I   live in   Cairo. ", "i live in cairo"],
    ["I’m fine", "i am fine"],
    ["I'm fine", "i am fine"],
    ["She doesn't know", "she does not know"],
    ["We can't go", "we cannot go"],
    ["We can not go", "we cannot go"],
    ["It won't work", "it will not work"],
    ["They're here", "they are here"],
    ["Let's go", "let us go"],
    ["I've finished", "i have finished"],
    ["Ali's car", "ali's car"],
    ["an e-mail", "an e mail"],
    ["I have 2 cats", "i have two cats"],
    ["“Hello”", "hello"],
    ["dont worry", "do not worry"],
    ["im here", "i am here"],
  ])("normalize(%j) = %j", (input, expected) => {
    expect(normalize(input)).toBe(expected);
  });

  it("tokenizes into words", () => {
    expect(tokenize("I am, here.")).toEqual(["i", "am", "here"]);
    expect(tokenize("   ")).toEqual([]);
  });
});

describe("alignTokens", () => {
  it("aligns identical sequences as all-equal", () => {
    expect(alignTokens(["a", "b"], ["a", "b"]).ops.map((o) => o.op)).toEqual(["equal", "equal"]);
  });
  it("finds deletions and insertions", () => {
    const ops = alignTokens(["i", "go", "to", "school"], ["i", "go", "school"]).ops;
    expect(ops.map((o) => o.op)).toEqual(["equal", "equal", "del", "equal"]);
  });
  it("prefers related substitutions", () => {
    const ops = alignTokens(["she", "goes", "to", "school"], ["she", "go", "school"]).ops;
    expect(ops.map((o) => o.op)).toEqual(["equal", "sub", "del", "equal"]);
  });
});

describe("helpers", () => {
  it("charDistance is Levenshtein distance", () => {
    expect(charDistance("receive", "recieve")).toBe(2);
    expect(charDistance("cat", "cat")).toBe(0);
    expect(charDistance("", "abc")).toBe(3);
  });
  it("sameBase recognises inflections and irregular forms", () => {
    expect(sameBase("go", "went")).toBe(true);
    expect(sameBase("play", "playing")).toBe(true);
    expect(sameBase("live", "lived")).toBe(true);
    expect(sameBase("stop", "stopped")).toBe(true);
    expect(sameBase("study", "studies")).toBe(true);
    expect(sameBase("child", "children")).toBe(true);
    expect(sameBase("cat", "dog")).toBe(false);
    expect(sameBase("cat", "cat")).toBe(false);
  });
});

describe("gradeSentence: correct answers", () => {
  it.each([
    ["I am a student.", ["I am a student."]],
    ["i am a student", ["I am a student."]],
    ["I AM A STUDENT!", ["I am a student."]],
    ["I’m a student.", ["I am a student."]],
    ["I'm a student", ["I am a student."]],
    ["It's cold.", ["It is cold."]],
    ["I have 2 brothers.", ["I have two brothers."]],
    ["  We   are at school .", ["We are at school."]],
    ["He doesn't work here.", ["He does not work here."]],
    ["We can not come.", ["We can't come."]],
    ["My sister is a nurse.", ["My sister is a nurse.", "My sister works as a nurse."]],
    ["My sister works as a nurse.", ["My sister is a nurse.", "My sister works as a nurse."]],
  ])("%j is accepted", (input, accepted) => {
    const r = gradeSentence(input, accepted);
    expect(r.correct).toBe(true);
    expect(r.score).toBe(1);
    expect(r.errors).toEqual([]);
  });
});

describe("gradeSentence: picks the closest accepted answer", () => {
  it("compares against the nearest answer, not the first", () => {
    const r = gradeSentence("My sister work as a nurse", ["My sister is a nurse.", "My sister works as a nurse."]);
    expect(r.best).toBe("My sister works as a nurse.");
    expect(r.errors.map((e) => e.type)).toEqual(["verb-form"]);
  });
});

describe("gradeSentence: error classification", () => {
  const cases: Array<[string, string, ErrorType[]]> = [
    // articles
    ["I have car.", "I have a car.", ["missing-article"]],
    ["She is teacher.", "She is a teacher.", ["missing-article"]],
    ["I went to market.", "I went to the market.", ["missing-article"]],
    ["I live in the Cairo.", "I live in Cairo.", ["extra-article"]],
    ["I like the coffee.", "I like coffee.", ["extra-article"]],
    ["I ate a apple.", "I ate an apple.", ["wrong-article"]],
    ["He is an doctor.", "He is a doctor.", ["wrong-article"]],
    // to be
    ["She happy.", "She is happy.", ["missing-be"]],
    ["They teachers.", "They are teachers.", ["missing-be"]],
    ["The weather nice today.", "The weather is nice today.", ["missing-be"]],
    ["I tired.", "I am tired.", ["missing-be"]],
    ["I am agree.", "I agree.", ["extra-be"]],
    ["He is work in a bank.", "He works in a bank.", ["extra-be", "verb-form"]],
    ["They is happy.", "They are happy.", ["verb-form"]],
    // prepositions
    ["I am in home.", "I am at home.", ["preposition"]],
    ["The book is in the table.", "The book is on the table.", ["preposition"]],
    ["I go school every day.", "I go to school every day.", ["preposition"]],
    ["I visited to London.", "I visited London.", ["preposition"]],
    ["She is good in English.", "She is good at English.", ["preposition"]],
    ["We arrived to the airport.", "We arrived at the airport.", ["preposition"]],
    // verb tense / form
    ["She go to school.", "She goes to school.", ["verb-form"]],
    ["He like football.", "He likes football.", ["verb-form"]],
    ["I go to the market yesterday.", "I went to the market yesterday.", ["verb-form"]],
    ["He is play football.", "He is playing football.", ["verb-form"]],
    ["I have finish my work.", "I have finished my work.", ["verb-form"]],
    ["She studys hard.", "She studies hard.", ["verb-form"]],
    ["We was late.", "We were late.", ["verb-form"]],
    ["He did not came.", "He did not come.", ["verb-form"]],
    ["I eated breakfast.", "I ate breakfast.", ["verb-form"]],
    // singular / plural
    ["I have two brother.", "I have two brothers.", ["plural"]],
    ["There are three childs.", "There are three children.", ["plural"]],
    ["She has many friend.", "She has many friends.", ["plural"]],
    ["I bought some apple.", "I bought some apples.", ["plural"]],
    // word order
    ["I like very much coffee.", "I like coffee very much.", ["word-order"]],
    ["I have a car red.", "I have a red car.", ["word-order"]],
    ["Where the station is?", "Where is the station?", ["word-order"]],
    ["She always is late.", "She is always late.", ["word-order"]],
    // spelling
    ["I recieve many emails.", "I receive many emails.", ["spelling"]],
    ["I was late becuase of traffic.", "I was late because of traffic.", ["spelling"]],
    ["Wensday is busy.", "Wednesday is busy.", ["spelling"]],
    ["My freind is here.", "My friend is here.", ["spelling"]],
    ["She is beautifull.", "She is beautiful.", ["spelling"]],
    ["I need your adress.", "I need your address.", ["spelling"]],
    // missing / extra / wrong words
    ["I want go home.", "I want to go home.", ["missing-word"]],
    ["I need to to go.", "I need to go.", ["extra-word"]],
    ["I very like it.", "I like it.", ["extra-word"]],
    ["I eat tea every morning.", "I drink tea every morning.", ["wrong-word"]],
    ["Please send me report.", "Please send me the report.", ["missing-article"]],
  ];

  it.each(cases)("%j vs %j", (input, accepted, expected) => {
    expect(types(input, [accepted])).toEqual(expected);
  });
});

describe("gradeSentence: multiple errors and scoring", () => {
  it("reports several errors in one sentence", () => {
    expect(types("She go school yesterday", ["She went to school yesterday."]).sort()).toEqual(
      ["preposition", "verb-form"].sort(),
    );
  });

  it("scores fewer mistakes higher", () => {
    const accepted = ["I went to the market yesterday."];
    const one = gradeSentence("I went to market yesterday.", accepted).score;
    const two = gradeSentence("I go to market yesterday.", accepted).score;
    const many = gradeSentence("market", accepted).score;
    expect(one).toBeGreaterThan(two);
    expect(two).toBeGreaterThan(many);
    expect(many).toBeGreaterThanOrEqual(0);
  });

  it("counts minor errors (spelling, articles) as half a mistake", () => {
    const r = gradeSentence("I have car.", ["I have a car."]);
    expect(r.score).toBeCloseTo(1 - 0.5 / 4);
  });

  it("handles an empty answer", () => {
    const r = gradeSentence("", ["I am here."]);
    expect(r.correct).toBe(false);
    expect(r.score).toBe(0);
    expect(r.errors.every((e) => e.type === "missing-word" || e.type === "missing-be")).toBe(true);
  });

  it("is deterministic", () => {
    const a = gradeSentence("She go school", ["She goes to school."]);
    const b = gradeSentence("She go school", ["She goes to school."]);
    expect(a).toEqual(b);
  });

  it("throws if no accepted answers are given", () => {
    expect(() => gradeSentence("hi", [])).toThrow();
  });
});

describe("gradeSentence: style notes (do not affect correctness)", () => {
  it("notes a missing capital at the start", () => {
    const r = gradeSentence("i am a student.", ["I am a student."]);
    expect(r.correct).toBe(true);
    expect(r.notes).toContain("start-capital");
    expect(r.notes).toContain("lowercase-i");
  });
  it("notes missing end punctuation", () => {
    expect(gradeSentence("I am a student", ["I am a student."]).notes).toContain("end-punctuation");
  });
  it("notes a missing apostrophe", () => {
    expect(gradeSentence("I dont know.", ["I don't know."]).notes).toContain("missing-apostrophe");
  });
  it("has no notes for a perfectly written answer", () => {
    expect(gradeSentence("I am a student.", ["I am a student."]).notes).toEqual([]);
  });
});
