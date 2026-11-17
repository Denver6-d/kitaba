import { DEFAULT_PROFILE, TABLE_NAMES, type SyncRecord, type TableMap, type TableName } from "@/domain/model";
import { mergeTable } from "@/domain/sync/merge";
import { mergeKeyStats, type KeyStats } from "@/domain/typing/key-stats";
import { updatePersonalBests, type PersonalBests } from "@/domain/typing/personal-best";
import { dayKey } from "@/domain/progress/streak";
import { EXPORT_VERSION, type ExportFile } from "./export";
import type { RecordStore } from "./store";
import type { Repositories } from "./types";

export interface RepositoryDeps {
  readonly store: RecordStore;
  readonly now?: () => number;
  readonly newId?: () => string;
}

const live = <R extends SyncRecord>(rows: R[]): R[] => rows.filter((r) => r.deletedAt === undefined);

/**
 * Builds every repository on top of a RecordStore. The same code serves the
 * local (Dexie), in-memory and Supabase backends, so behaviour cannot drift
 * between them.
 */
export function createRepositories({ store, now = Date.now, newId = () => crypto.randomUUID() }: RepositoryDeps): Repositories {
  const bestsFrom = async (): Promise<PersonalBests> => {
    let bests: PersonalBests = {};
    const results = live(await store.all("results")).sort((a, b) => a.at - b.at);
    for (const r of results) {
      bests = updatePersonalBests(bests, { modeKey: r.modeKey, wpm: r.wpm, accuracy: r.accuracy, at: r.at }).bests;
    }
    return bests;
  };

  const keyStats = async (): Promise<KeyStats> =>
    live(await store.all("keystats")).reduce<KeyStats>((acc, d) => mergeKeyStats(acc, d.stats), {});

  const addKeyStats = async (stats: KeyStats) => {
    if (Object.keys(stats).length === 0) return;
    const t = now();
    await store.put("keystats", { id: newId(), updatedAt: t, at: t, stats });
  };

  return {
    progress: {
      async saveTestResult(result, extras) {
        const before = await bestsFrom();
        const previousBest = before[result.modeKey]?.wpm ?? null;
        const { isNew } = updatePersonalBests(before, {
          modeKey: result.modeKey,
          wpm: result.wpm,
          accuracy: result.accuracy,
          at: result.at,
        });
        const record = { ...result, id: newId(), updatedAt: now() };
        await store.put("results", record);
        await addKeyStats(extras.keyStats);
        if (isNew && extras.ghost.length > 0) {
          await store.put("ghosts", {
            id: result.modeKey,
            updatedAt: now(),
            modeKey: result.modeKey,
            wpm: result.wpm,
            target: extras.target,
            ghost: extras.ghost,
          });
        }
        return { record, isNewBest: isNew, previousBest };
      },
      async listResults() {
        return live(await store.all("results")).sort((a, b) => a.at - b.at);
      },
      personalBests: bestsFrom,
      keyStats,
      addKeyStats,
      async ghost(modeKey) {
        const g = await store.get("ghosts", modeKey);
        return g && g.deletedAt === undefined ? g : undefined;
      },
    },

    activity: {
      async log(kind, seconds, xp) {
        const t = now();
        await store.put("activity", {
          id: newId(),
          updatedAt: t,
          kind,
          at: t,
          day: dayKey(new Date(t)),
          seconds: Math.max(0, Math.round(seconds)),
          xp: Math.max(0, Math.round(xp)),
        });
      },
      async list() {
        return live(await store.all("activity")).sort((a, b) => a.at - b.at);
      },
    },

    words: {
      async card(wordId) {
        const c = await store.get("srs", wordId);
        return c && c.deletedAt === undefined ? c : undefined;
      },
      async saveCard(card) {
        await store.put("srs", { ...card, id: card.wordId, updatedAt: now() });
      },
      async allCards() {
        return live(await store.all("srs"));
      },
      async dueCards(at) {
        return live(await store.all("srs"))
          .filter((c) => c.due <= at)
          .sort((a, b) => a.due - b.due);
      },
    },

    sentences: {
      async saveAttempt(attempt) {
        await store.put("attempts", { ...attempt, id: newId(), updatedAt: now() });
      },
      async attempts() {
        return live(await store.all("attempts")).sort((a, b) => a.at - b.at);
      },
      async mastery(itemKey) {
        const m = await store.get("mastery", itemKey);
        return m && m.deletedAt === undefined ? m.mastery : 0;
      },
      async allMastery() {
        return Object.fromEntries(live(await store.all("mastery")).map((m) => [m.id, m.mastery]));
      },
      async setMastery(itemKey, mastery) {
        await store.put("mastery", { id: itemKey, updatedAt: now(), mastery });
      },
    },

    scenarios: {
      async saveAttempt(attempt) {
        await store.put("scenarios", { ...attempt, id: newId(), updatedAt: now() });
      },
      async attempts() {
        return live(await store.all("scenarios")).sort((a, b) => a.at - b.at);
      },
    },

    achievements: {
      async list() {
        return live(await store.all("achievements"));
      },
      async unlock(ids) {
        const existing = new Set(live(await store.all("achievements")).map((a) => a.id));
        const fresh = [...new Set(ids)].filter((id) => !existing.has(id));
        const t = now();
        if (fresh.length > 0) {
          await store.bulkPut("achievements", fresh.map((id) => ({ id, updatedAt: t, unlockedAt: t })));
        }
        return fresh;
      },
    },

    profile: {
      async get() {
        return (await store.get("profile", "me")) ?? DEFAULT_PROFILE;
      },
      async save(patch) {
        const current = (await store.get("profile", "me")) ?? DEFAULT_PROFILE;
        const next = { ...current, ...patch, id: "me", updatedAt: now() };
        await store.put("profile", next);
        return next;
      },
    },

    data: {
      async exportAll(): Promise<ExportFile> {
        const entries = await Promise.all(TABLE_NAMES.map(async (t) => [t, await store.all(t)] as const));
        return {
          app: "kitaba",
          version: EXPORT_VERSION,
          exportedAt: now(),
          tables: Object.fromEntries(entries) as unknown as Record<TableName, SyncRecord[]>,
        };
      },
      async importAll(file, mode) {
        // One atomic unit: a failure part-way never leaves a half-cleared database.
        await store.atomic(async () => {
          if (mode === "replace") await store.clear();
          for (const table of TABLE_NAMES) {
            const incoming = (file.tables[table] ?? []) as TableMap[typeof table][];
            if (incoming.length === 0) continue;
            const local = mode === "replace" ? [] : await store.all(table);
            const { toLocal } = mergeTable(table, local, incoming);
            if (toLocal.length > 0) await store.bulkPut(table, toLocal);
          }
        });
      },
      async clearAll() {
        await store.clear();
      },
    },
  };
}
