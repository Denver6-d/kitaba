import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { spellingWords } from "@/data/words";
import { validateContent } from "@/data/validate";
import { ALL_STAGE_IDS, stageDef } from "@/domain/games/campaign";
import { LEVELS } from "@/domain/model";
import { SPELLING_CATEGORIES } from "@/domain/spelling/categories";

/** Content validator: every data file must satisfy its schema and the integrity rules in src/data/validate.ts. */

const v1Ids = JSON.parse(readFileSync(new URL("../fixtures/v1-word-ids.json", import.meta.url), "utf8")) as string[];
const report = validateContent(spellingWords, v1Ids);

describe("spelling content", () => {
  it("has no validation issues (schema, duplicates, examples, V1 ids)", () => {
    expect(report.issues).toEqual([]);
  });

  it("has the required volume: 1,500+ words, 800+ dictation sentences, every category and level well covered", () => {
    expect(report.words).toBeGreaterThanOrEqual(1500);
    expect(report.dictationSentences).toBeGreaterThanOrEqual(800);
    for (const c of SPELLING_CATEGORIES) expect(report.byCategory[c], c).toBeGreaterThanOrEqual(90);
    for (const l of LEVELS) expect(report.byLevel[l], l).toBeGreaterThanOrEqual(150);
  });

  it("gives every campaign stage enough words to fill it (a Spelling Bee needs at least 25)", () => {
    for (const id of ALL_STAGE_IDS) {
      const d = stageDef(id);
      if (!d) throw new Error(id);
      const pool = spellingWords.filter((w) => d.world.categories.includes(w.category) && d.levels.includes(w.level)).length;
      expect(pool, id).toBeGreaterThanOrEqual(d.timed ? 25 : d.items + 2);
    }
  });
});
