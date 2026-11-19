import { describe, expect, it } from "vitest";
import { buildSession, type GameRequest } from "@/features/games/build-session";
import { getLibrary } from "@/features/library/library";
import { spellingWordById, spellingWords } from "@/data/words";
import { ALL_STAGE_IDS, DAILY_MODES, stageDef } from "@/domain/games/campaign";
import { LEVELS, sameLevels, type CefrLevel } from "@/domain/model";
import { levelsByDistance } from "@/domain/levels/pool";
import { seededRng } from "@/domain/shared/random";
import { newCard, DAY_MS } from "@/domain/spelling/srs";
import { createMemoryOutbox } from "@/repositories/local/outbox";
import { createMemoryStore } from "@/repositories/store";
import { createRepositories } from "@/repositories/create";

const NOW = Date.UTC(2026, 10, 17, 12);

function deps(seed = 1) {
  const repos = createRepositories({ store: createMemoryStore(), now: () => NOW, newId: () => "id" });
  return { repos, meta: createMemoryOutbox(), accent: "us" as const, rng: seededRng(seed), now: NOW };
}

const wordOf = (wordId: string) => {
  const w = spellingWordById.get(wordId);
  if (!w) throw new Error(`unknown word ${wordId}`);
  return w;
};


describe("buildSession: stages", () => {
  it("returns an empty, untimed session for an unknown stage", async () => {
    const s = await buildSession({ kind: "stage", id: "w99-s1" }, deps());
    expect(s).toMatchObject({ items: [], stageId: "w99-s1", boss: false, config: { durationMs: null } });
  });

  it("fills a normal stage with its item count from the world's categories at the learner's words level", async () => {
    const def = stageDef("w6-s2");
    const s = await buildSession({ kind: "stage", id: "w6-s2" }, deps());
    expect(s.items).toHaveLength(def?.items ?? -1);
    expect(s).toMatchObject({ stageId: "w6-s2", mode: "choice", boss: false, level: "A2", config: { durationMs: null, speedBonus: false } });
    for (const item of s.items) {
      const w = wordOf(item.wordId);
      expect(def?.world.categories).toContain(w.category);
      expect(w.level).toBe("A2");
    }
  });

  it("never repeats a word inside one session and keeps item keys unique", async () => {
    for (const id of ["w1-s1", "w5-s7", "w8-s10"]) {
      const s = await buildSession({ kind: "stage", id }, deps(3));
      expect(new Set(s.items.map((i) => i.wordId)).size).toBe(s.items.length);
      expect(new Set(s.items.map((i) => i.key)).size).toBe(s.items.length);
    }
  });

  it("makes stage 9 a timed Spelling Bee with a speed bonus", async () => {
    const s = await buildSession({ kind: "stage", id: "w2-s9" }, deps());
    expect(s.config).toEqual({ durationMs: 60_000, speedBonus: true });
    expect(s.mode).toBe("bee");
    expect(s.items.length).toBeGreaterThan(10);
  });

  it("builds every boss stage as a mixed session with its full item count", async () => {
    for (const id of ALL_STAGE_IDS.filter((x) => x.endsWith("-s10"))) {
      const s = await buildSession({ kind: "stage", id }, deps(11));
      expect(s.boss).toBe(true);
      expect(s.mode).toBe("mixed");
      expect(s.items).toHaveLength(stageDef(id)?.items ?? -1);
    }
  });

  it("persists the shuffle-bag so the next play continues the same pass", async () => {
    const d = deps(5);
    const req: GameRequest = { kind: "free", mode: "listen", level: null, category: null };
    const first = await buildSession(req, d);
    const second = await buildSession(req, { ...d, rng: seededRng(6) });
    expect(await d.meta.getMeta("bag:free:A2:all")).toBeDefined();
    const overlap = second.items.filter((i) => first.items.some((f) => f.wordId === i.wordId));
    expect(overlap).toEqual([]);
  });

  it("is deterministic for a given seed", async () => {
    const a = await buildSession({ kind: "stage", id: "w4-s6" }, deps(42));
    const b = await buildSession({ kind: "stage", id: "w4-s6" }, deps(42));
    expect(a.items).toEqual(b.items);
  });
});

describe("buildSession: daily challenge", () => {
  it("gives everyone the same items on the same day, whatever the device's rng or bag state", async () => {
    const a = await buildSession({ kind: "daily" }, deps(1));
    const b = await buildSession({ kind: "daily" }, deps(999));
    expect(a.items).toEqual(b.items);
    expect(a.items.map((i) => i.mode).every((m, i) => m === DAILY_MODES[i] || m === "listen")).toBe(true);
    expect(a).toMatchObject({ mode: "mixed", boss: false, stageId: expect.stringMatching(/^daily:\d{4}-\d{2}-\d{2}$/) });
    expect(a.items).toHaveLength(DAILY_MODES.length);
  });

  it("changes the words on the next day", async () => {
    const today = await buildSession({ kind: "daily" }, deps());
    const tomorrow = await buildSession({ kind: "daily" }, { ...deps(), now: NOW + DAY_MS });
    expect(tomorrow.stageId).not.toBe(today.stageId);
    expect(tomorrow.items.map((i) => i.wordId)).not.toEqual(today.items.map((i) => i.wordId));
  });

  it("uses the learner's tests level", async () => {
    for (const level of LEVELS) {
      const d = deps();
      await d.repos.profile.save({ levels: { words: "A1", sentences: "A1", tests: level } });
      const s = await buildSession({ kind: "daily" }, d);
      expect(s.level).toBe(level);
      for (const i of s.items) expect(wordOf(i.wordId).level).toBe(level);
    }
  });
});

describe("buildSession: free play", () => {
  it("uses the words level when the URL names none", async () => {
    const d = deps();
    await d.repos.profile.save({ levels: { words: "C1", sentences: "A1", tests: "A1" } });
    const s = await buildSession({ kind: "free", mode: "listen", level: null, category: null }, d);
    expect(s.level).toBe("C1");
    for (const i of s.items) expect(wordOf(i.wordId).level).toBe("C1");
  });

  it("filters by level and category and plays 10 untimed items", async () => {
    const req: GameRequest = { kind: "free", mode: "listen", level: "A2", category: "silent-letters" };
    const s = await buildSession(req, deps());
    expect(s.items.length).toBeGreaterThan(0);
    expect(s.items.length).toBeLessThanOrEqual(10);
    expect(s).toMatchObject({ stageId: null, mode: "listen", config: { durationMs: null } });
    for (const i of s.items) expect(wordOf(i.wordId)).toMatchObject({ level: "A2", category: "silent-letters" });
  });

  it("times Spelling Bee free play", async () => {
    const s = await buildSession({ kind: "free", mode: "bee", level: null, category: null }, deps());
    expect(s.config).toEqual({ durationMs: 60_000, speedBonus: true });
    expect(s.items).toHaveLength(40);
  });

  it("asks for the British spelling when the learner chose UK", async () => {
    const s = await buildSession({ kind: "free", mode: "listen", level: null, category: "british-american" }, { ...deps(), accent: "uk" });
    for (const i of s.items) expect(i.answer).toBe(wordOf(i.wordId).uk ?? wordOf(i.wordId).word);
  });
});

describe("buildSession: review", () => {
  it("plays only due cards, oldest first, at most 15", async () => {
    const d = deps();
    const ids = spellingWords.slice(0, 20).map((w) => w.id);
    for (const [n, id] of ids.entries()) await d.repos.words.saveCard({ ...newCard(id, NOW), due: NOW - (20 - n) * 1000 });
    await d.repos.words.saveCard({ ...newCard(spellingWords[30]?.id ?? "", NOW), due: NOW + DAY_MS });
    const s = await buildSession({ kind: "review" }, d);
    expect(s.items.map((i) => i.wordId)).toEqual(ids.slice(0, 15));
    expect(s.items.every((i) => i.mode === "review")).toBe(true);
    expect(s).toMatchObject({ mode: "review", stageId: null });
  });

  it("returns an empty session when nothing is due, and skips cards for removed words", async () => {
    const d = deps();
    expect((await buildSession({ kind: "review" }, d)).items).toEqual([]);
    await d.repos.words.saveCard({ ...newCard("w-no-such-word", NOW), due: NOW - 1 });
    // The library is reachable and does not have the word: it was removed, so its card is skipped.
    const reachable = { ...getLibrary(), manifest: async () => ({ version: 1 as const, files: {} }), findWords: async () => new Map() };
    expect((await buildSession({ kind: "review" }, { ...d, library: reachable })).items).toEqual([]);
  });
});

/**
 * Regression (DECISIONS E1): choosing B1 in the play menu changed nothing,
 * because the level lived in component state and campaign stages and the
 * daily challenge never read it.
 */
describe("buildSession: stored levels take effect on the next game", () => {
  const levelsOf = (items: readonly { wordId: string }[]) => new Set(items.map((i) => wordOf(i.wordId).level));

  it("plays the first stage at B1 after the learner chooses B1, not at A1", async () => {
    const d = deps();
    const before = await buildSession({ kind: "stage", id: "w1-s1" }, d);
    expect([...levelsOf(before.items)]).toEqual(["A2"]);
    await d.repos.profile.save({ levels: sameLevels("B1"), levelSource: "choice" });
    const after = await buildSession({ kind: "stage", id: "w1-s1" }, d);
    expect(after.level).toBe("B1");
    expect([...levelsOf(after.items)]).toEqual(["B1"]);
  });

  it("uses the tests level for boss stages and the words level for the others", async () => {
    const d = deps(4);
    await d.repos.profile.save({ levels: { words: "A1", sentences: "A1", tests: "B2" } });
    const boss = await buildSession({ kind: "stage", id: "w3-s10" }, d);
    const normal = await buildSession({ kind: "stage", id: "w3-s1" }, d);
    expect(boss.level).toBe("B2");
    expect(normal.level).toBe("A1");
    expect([...levelsOf(normal.items)]).toEqual(["A1"]);
  });

  it("fills every stage at every level, widening to the nearest levels when a world is short", async () => {
    for (const level of LEVELS) {
      const d = deps(7);
      await d.repos.profile.save({ levels: sameLevels(level) });
      for (const id of ALL_STAGE_IDS) {
        const def = stageDef(id);
        const s = await buildSession({ kind: "stage", id }, d);
        if (!def?.timed) expect(s.items, `${id} at ${level}`).toHaveLength(def?.items ?? -1);
        else expect(s.items.length, `${id} at ${level}`).toBeGreaterThanOrEqual(25);
        const allowed: CefrLevel[] = levelsByDistance(level).slice(0, 3);
        for (const i of s.items) expect(allowed).toContain(wordOf(i.wordId).level);
      }
    }
  }, 60_000);

  it("starts a fresh shuffle-bag when the level changes", async () => {
    const d = deps(8);
    await buildSession({ kind: "stage", id: "w2-s1" }, d);
    await d.repos.profile.save({ levels: sameLevels("C1") });
    const s = await buildSession({ kind: "stage", id: "w2-s1" }, d);
    expect(levelsOf(s.items).has("C1")).toBe(true);
    expect(await d.meta.getMeta("bag:stage:w2-s1:A2")).toBeDefined();
  });
});
