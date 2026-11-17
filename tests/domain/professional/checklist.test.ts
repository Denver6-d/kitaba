import { describe, expect, it } from "vitest";
import { checkMessage, wordCount, type CheckId, type ScenarioRules } from "@/domain/professional/checklist";

const scenario = {
  minWords: 30,
  maxWords: 120,
  mustMention: [
    { labelAr: "التاريخ", labelEn: "the date", anyOf: ["monday", "tuesday", "date"] },
    { labelAr: "السبب", labelEn: "the reason", anyOf: ["because", "reason", "appointment"] },
  ],
};

const good = `Dear Mr. Khalid,

I would like to ask for a day off on Monday, 12 May, because I have a medical appointment. I have finished the weekly report, and Sara has agreed to answer my emails while I am away.

Please let me know if this is possible. Thank you for your understanding.

Best regards,
Omar`;

const failed = (text: string, s: ScenarioRules = scenario): CheckId[] =>
  checkMessage(text, s)
    .filter((c) => !c.passed)
    .map((c) => c.id);

describe("wordCount", () => {
  it("counts words, ignoring punctuation and extra spaces", () => {
    expect(wordCount("  Hello,   world! It's me. ")).toBe(4);
    expect(wordCount("")).toBe(0);
  });
});

describe("checkMessage", () => {
  it("passes a well-formed message", () => {
    expect(failed(good)).toEqual([]);
  });

  it("reports one item per rule plus one per required mention", () => {
    expect(checkMessage(good, scenario).map((c) => c.id)).toEqual([
      "greeting",
      "closing",
      "polite",
      "capitalization",
      "punctuation",
      "length",
      "noTextSpeak",
      "mention-0",
      "mention-1",
    ]);
  });

  it("flags a missing greeting and closing", () => {
    const text = good.replace("Dear Mr. Khalid,\n\n", "").replace("\n\nBest regards,\nOmar", "");
    expect(failed(text)).toEqual(expect.arrayContaining(["greeting", "closing"]));
  });

  it("accepts common greetings and closings", () => {
    for (const g of ["Hello Sara,", "Hi team,", "Good morning Ms. Lee,"]) {
      expect(failed(good.replace("Dear Mr. Khalid,", g))).not.toContain("greeting");
    }
    for (const c of ["Kind regards,", "Sincerely,", "Many thanks,", "Best wishes,"]) {
      expect(failed(good.replace("Best regards,", c))).not.toContain("closing");
    }
  });

  it("needs a name after the closing phrase", () => {
    expect(failed(good.replace("\nOmar", ""))).toContain("closing");
  });

  it("flags a missing polite phrase", () => {
    const rude = good.replace("Please let me know if this is possible. Thank you for your understanding.", "Tell me today.");
    expect(failed(rude)).toContain("polite");
  });

  it("flags lowercase sentence starts and a lowercase i", () => {
    expect(failed(good.replace("I have finished", "i have finished"))).toContain("capitalization");
    expect(failed(good.replace("Please let me know", "please let me know"))).toContain("capitalization");
  });

  it("does not treat abbreviations like a.m. or Mr. as sentence ends", () => {
    const text = good.replace("Please let me know if this is possible.", "Would 10 a.m. work for you? Mr. Ali can join.");
    expect(failed(text)).not.toContain("capitalization");
  });

  it("flags body lines that do not end with punctuation", () => {
    expect(failed(good.replace("Thank you for your understanding.", "Thank you for your understanding"))).toContain("punctuation");
  });

  it("checks length against the scenario range", () => {
    expect(failed("Dear Sir,\n\nPlease help. Thank you.\n\nBest regards,\nOmar")).toContain("length");
    expect(failed(`${good}\n${"word ".repeat(200)}`)).toContain("length");
  });

  it("flags text-speak abbreviations", () => {
    expect(failed(good.replace("Please let me know", "Pls let me know"))).toContain("noTextSpeak");
    expect(failed(good.replace("if this is possible", "if u can"))).toContain("noTextSpeak");
  });

  it("checks required mentions by keyword", () => {
    const noDate = good.replace("on Monday, 12 May, ", "");
    expect(failed(noDate)).toContain("mention-0");
    expect(failed(noDate)).not.toContain("mention-1");
  });

  it("fails everything sensible for empty text", () => {
    expect(failed("")).toEqual(expect.arrayContaining(["greeting", "closing", "polite", "length"]));
  });
});

describe("checkMessage: review regressions", () => {
  const timeRule = { minWords: 1, maxWords: 500, mustMention: [{ anyOf: ["@time"] }, { anyOf: ["@day", "@date"] }] };
  const mentionFails = (text: string) => failed(text, timeRule).filter((id) => id.startsWith("mention"));

  it("matches times written with a.m./p.m. and 24-hour times", () => {
    expect(mentionFails("Can we meet at 10 a.m. on Sunday?")).toEqual([]);
    expect(mentionFails("Can we meet at 3pm on 14 March?")).toEqual([]);
    expect(mentionFails("Can we meet at 14:30 tomorrow?")).toEqual([]);
  });
  it("includes Saturday and Sunday and month dates", () => {
    expect(mentionFails("See you at noon on Saturday.")).toEqual([]);
    expect(mentionFails("See you at 9 a.m. on 3 June.")).toEqual([]);
  });
  it("does not flag i.e. or sentences that start with a number", () => {
    const text = good.replace("I have finished the weekly report", "3 days ago I finished the weekly report, i.e. the sales summary");
    expect(failed(text)).not.toContain("capitalization");
  });
  it("does not treat R&D or U.S. as text-speak", () => {
    expect(failed(good.replace("the weekly report", "the R&D report for the U.S. office"))).not.toContain("noTextSpeak");
  });
  it("accepts 'To whom it may concern' and a one-line closing with a name", () => {
    expect(failed(good.replace("Dear Mr. Khalid,", "To whom it may concern,"))).not.toContain("greeting");
    const oneLine = good.replace("Best regards,\nOmar", "Best regards, Omar");
    expect(failed(oneLine)).not.toContain("closing");
    expect(failed(oneLine)).not.toContain("punctuation");
  });
  it("matches keywords as whole words with simple inflections only", () => {
    const rule = { minWords: 1, maxWords: 500, mustMention: [{ anyOf: ["hear"] }, { anyOf: ["apply"] }] };
    expect(failed("I love my heart. Please. Thanks.", rule)).toContain("mention-0");
    expect(failed("I am applying now.", rule)).not.toContain("mention-1");
  });
  it("normalises curly apostrophes", () => {
    const rule = { minWords: 1, maxWords: 500, mustMention: [{ anyOf: ["can't"] }] };
    expect(failed("I can’t come.", rule)).not.toContain("mention-0");
  });
});
