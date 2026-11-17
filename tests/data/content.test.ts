import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { spellingWords } from "@/data/words";
import { validateContent } from "@/data/validate";

/** Content validator: every data file must satisfy its schema and the integrity rules in src/data/validate.ts. */

const v1Ids = JSON.parse(readFileSync(new URL("../fixtures/v1-word-ids.json", import.meta.url), "utf8")) as string[];
const report = validateContent(spellingWords, v1Ids);

describe("spelling content", () => {
  it("has no validation issues (schema, duplicates, examples, V1 ids)", () => {
    expect(report.issues).toEqual([]);
  });
});
