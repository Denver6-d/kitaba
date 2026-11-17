import { DEFAULT_PROFILE, TABLE_NAMES, type StageRecord, type SyncRecord, type TableMap, type TableName } from "@/domain/model";
import { compareStage, mergeTable } from "@/domain/sync/merge";
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
const alive = <R extends SyncRecord>(r: R | undefined): R | undefined => (r && r.deletedAt === undefined ? r : undefined);

/** The better of two results for one stage, keeping the earliest clear time. */
export function bestStage(previous: StageRecord | null, candidate: StageRecord): StageRecord {
  if (!previous) return candidate;
  const winner = compareStage(candidate, previous) > 0 ? candidate : previous;
  const clears = [previous.clearedAt, candidate.clearedAt].filter((c) => c > 0);
  return { ...winner, clearedAt: clears.length > 0 ? Math.min(...clears) : 0 };
}

/**
 * Builds every repository on top of a RecordStore. The same code serves the
 * local (Dexie), in-memory and Supabase backends, so behaviour cannot drift
 * between them.
 */
export function createRepositories({ store, now = Date.now, newId = () => crypto.randomUUID() }: RepositoryDeps): Repositories {
  return {
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
        return alive(await store.get("srs", wordId));
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

    mastery: {
      async get(itemKey) {
        return alive(await store.get("mastery", itemKey))?.mastery ?? 0;
      },
      async all() {
        return Object.fromEntries(live(await store.all("mastery")).map((m) => [m.id, m.mastery]));
      },
      async set(itemKey, mastery) {
        await store.put("mastery", { id: itemKey, updatedAt: now(), mastery });
      },
    },

    games: {
      async saveSession(session, stars) {
        const t = now();
        const record = { ...session, id: newId(), updatedAt: t };
        await store.put("sessions", record);
        if (session.stageId === null) return { record, previous: null, best: null };
        const previous = alive(await store.get("stages", session.stageId)) ?? null;
        const candidate: StageRecord = {
          id: session.stageId,
          updatedAt: t,
          stars,
          bestPoints: session.points,
          clearedAt: stars > 0 ? session.at : 0,
        };
        const merged = bestStage(previous, candidate);
        const changed = !previous || compareStage(merged, previous) !== 0 || merged.clearedAt !== previous.clearedAt;
        const best = changed ? { ...merged, updatedAt: t } : previous;
        if (changed) await store.put("stages", best);
        return { record, previous, best };
      },
      async sessions() {
        return live(await store.all("sessions")).sort((a, b) => a.at - b.at);
      },
      async stages() {
        return Object.fromEntries(live(await store.all("stages")).map((s) => [s.id, s]));
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
