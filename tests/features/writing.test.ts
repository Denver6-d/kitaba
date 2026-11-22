import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { buildSession, writingWord, WRITING_WORD_AR } from "@/features/games/build-session";
import { addedToReview, addToReview, sentenceWith, writingCardId } from "@/features/writing/use-save-writing";
import { summarizeWriting } from "@/domain/writing/summary";
import { DAY_MS, newCard } from "@/domain/spelling/srs";
import { WRITING_TEXT_MAX } from "@/domain/model";
import { seededRng } from "@/domain/shared/random";
import { createRepositories } from "@/repositories/create";
import { parseExportFile } from "@/repositories/export";
import { createDexieStore, openDb } from "@/repositories/local/db";
import { createMemoryOutbox } from "@/repositories/local/outbox";
import { createMemoryStore } from "@/repositories/store";

const NOW = Date.UTC(2026, 10, 18, 12);
const repos = () => createRepositories({ store: createMemoryStore(), now: () => NOW, newId: () => crypto.randomUUID() });

const writing = (over: Partial<Parameters<ReturnType<typeof repos>["writing"]["save"]>[0]> = {}) => ({
  mode: "free" as const,
  sourceId: "sc-a1-001",
  level: "A1" as const,
  text: "I like my blu bike.",
  words: 5,
  mistakes: 1,
  accuracy: 0.8,
  stars: 2,
  at: NOW,
  missed: [{ wrong: "blu", right: "blue", type: "other" }],
  ...over,
});

describe("writing repository", () => {
  it("saves history newest first and caps long texts", async () => {
    const r = repos();
    await r.writing.save(writing({ at: NOW - 10 }));
    await r.writing.save(writing({ at: NOW, text: "x".repeat(WRITING_TEXT_MAX + 50) }));
    const list = await r.writing.list();
    expect(list.map((w) => w.at)).toEqual([NOW, NOW - 10]);
    expect(list[0]?.text).toHaveLength(WRITING_TEXT_MAX);
  });

  it("round-trips through export and import", async () => {
    const a = repos();
    await a.writing.save(writing());
    await a.dictionary.add("Padel");
    const file = parseExportFile(JSON.stringify(await a.data.exportAll()));
    const b = repos();
    await b.data.importAll(file, "replace");
    expect(await b.writing.list()).toHaveLength(1);
    expect(await b.dictionary.words()).toEqual(["padel"]);
  });
});

describe("personal dictionary", () => {
  it("adds lower-cased words and removes them with a tombstone (so removal syncs)", async () => {
    const r = repos();
    await r.dictionary.add("  Zarqa ");
    await r.dictionary.add("padel");
    expect((await r.dictionary.words()).sort()).toEqual(["padel", "zarqa"]);
    await r.dictionary.remove("Zarqa");
    expect(await r.dictionary.words()).toEqual(["padel"]);
    const exported = await r.data.exportAll();
    expect(exported.tables.dictionary.find((d) => d.id === "zarqa")?.deletedAt).toBe(NOW);
  });
});

describe("Dexie v4", () => {
  it("adds the writings and dictionary stores on top of v3 data", async () => {
    const indexedDB = new IDBFactory();
    const db3 = openDb({ indexedDB, IDBKeyRange }, "v4");
    await createRepositories({ store: createDexieStore(db3) }).profile.save({ dailyGoalMinutes: 20 });
    db3.close();
    const db = openDb({ indexedDB, IDBKeyRange }, "v4");
    const r = createRepositories({ store: createDexieStore(db) });
    await r.writing.save(writing());
    await r.dictionary.add("padel");
    expect(await r.writing.list()).toHaveLength(1);
    expect((await r.profile.get()).dailyGoalMinutes).toBe(20);
    expect(db.verno).toBe(4);
    db.close();
  });
});

describe("mistakes go to the review deck", () => {
  it("reuses the bank's card id for a bank word and makes an own id otherwise", () => {
    expect(writingCardId("Receive")).toBe("w-receive");
    expect(writingCardId("colour")).toBe("w-color");
    expect(writingCardId("tomorrow's")).toMatch(/^x-|^w-/);
    expect(writingCardId("padel")).toBe("x-padel");
  });

  it("adds exactly the words shown to practise, never a misspelling without a suggestion (regression: prestegeous)", async () => {
    const r = repos();
    const text = "Real discpline is prestegeous. Knowlege grows when you endevor every day.";
    const summary = summarizeWriting(12, [
      { wrong: "discpline", right: "discipline", type: "other" },
      { wrong: "prestegeous", right: null, type: "other" },
      { wrong: "Knowlege", right: "Knowledge", type: "silent" },
      { wrong: "endevor", right: "endeavor", type: "vowel" },
      { wrong: "i", right: "I", type: "capital" },
    ]);
    const saved = await addToReview(r.words, { text, summary }, NOW);
    expect(saved.reviewed).toEqual(["discipline", "knowledge", "endeavor"]);
    expect(addedToReview(summary.practice, saved.reviewed)).toBe(summary.practice.length);
    const cards = await r.words.allCards();
    expect(cards).toHaveLength(3);
    expect(cards.map((c) => c.word ?? c.id).join(" ")).not.toMatch(/prestegeous|prestig/);
    expect(cards.find((c) => c.id === writingCardId("Knowledge"))?.context).toBe("Knowledge grows when you endevor every day.");
  });

  it("keeps the count in step with the words shown when one is removed (added to the dictionary)", async () => {
    const summary = summarizeWriting(8, [
      { wrong: "discpline", right: "discipline", type: "other" },
      { wrong: "endevor", right: "endeavor", type: "vowel" },
    ]);
    const saved = await addToReview(repos().words, { text: "My discpline. I endevor.", summary }, NOW);
    const after = summarizeWriting(8, [{ wrong: "endevor", right: "endeavor", type: "vowel" }]);
    expect(addedToReview(after.practice, saved.reviewed)).toBe(1);
  });

  it("finds the sentence a word came from", () => {
    expect(sentenceWith("Hi Sam. I beleive you. See you soon!", "beleive")).toBe("I beleive you.");
    expect(sentenceWith("Line one\nLine two has it", "has")).toBe("Line two has it");
  });

  it("builds review items for own words, with the source sentence as the example", async () => {
    const r = repos();
    await r.words.saveCard({ ...newCard("x-padel", NOW), due: NOW - DAY_MS, word: "padel", context: "We play padel on Friday." });
    await r.words.saveCard({ ...newCard("w-receive", NOW), due: NOW - DAY_MS, context: "I receive emails." });
    await r.words.saveCard({ ...newCard("x-gone", NOW), due: NOW - DAY_MS }); // no word stored: skipped
    const s = await buildSession({ kind: "review" }, { repos: r, meta: createMemoryOutbox(), accent: "us", rng: seededRng(1), now: NOW });
    expect(s.items.map((i) => i.wordId).sort()).toEqual(["w-receive", "x-padel"]);
    expect(s.extraWords?.get("x-padel")).toMatchObject({ word: "padel", ar: WRITING_WORD_AR, example: "We play padel on Friday." });
  });

  it("falls back to the word itself when the stored sentence does not contain it", () => {
    const card = { ...newCard("x-padel", NOW), id: "x-padel", updatedAt: NOW, word: "padel", context: "Something else." };
    expect(writingWord(card)?.example).toBe("padel.");
    expect(writingWord({ ...card, word: undefined } as never)).toBeNull();
  });
});
