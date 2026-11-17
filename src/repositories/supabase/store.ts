import type { SupabaseClient } from "@supabase/supabase-js";
import { TABLE_NAMES, type SyncRecord, type TableMap, type TableName } from "@/domain/model";
import { recordSchemas } from "../export";
import type { RecordStore } from "../store";

/**
 * Supabase backend for the RecordStore contract. Every record is one row of
 * public.progress_records; RLS limits every query to the signed-in user.
 * Rows read back are validated with the same strict schemas as file imports,
 * so a corrupt remote row can never break the local app.
 */

const PAGE = 1000;
const BATCH = 200;

interface Row {
  readonly table_name: string;
  readonly id: string;
  readonly data: unknown;
  readonly server_updated_at: string;
}

export interface PulledRecord {
  readonly table: TableName;
  readonly record: SyncRecord;
}

export interface SupabaseRemote extends RecordStore {
  /** Upserts with server-side last-write-wins (never overwrites a newer row). */
  upsert(items: ReadonlyArray<{ table: TableName; record: SyncRecord }>): Promise<void>;
  /** Rows changed after `sinceIso` (server clock), oldest first. */
  pullSince(sinceIso: string | null): Promise<{ records: PulledRecord[]; cursor: string | null }>;
}

const isTable = (t: string): t is TableName => (TABLE_NAMES as readonly string[]).includes(t);

function parseRow(row: Row): PulledRecord | null {
  if (!isTable(row.table_name)) return null;
  const parsed = recordSchemas[row.table_name].safeParse(row.data);
  return parsed.success ? { table: row.table_name, record: parsed.data as SyncRecord } : null;
}

const toRow = (table: TableName, r: SyncRecord) => ({
  table_name: table,
  id: r.id,
  data: r,
  updated_at: Math.round(r.updatedAt),
  deleted_at: r.deletedAt === undefined ? null : Math.round(r.deletedAt),
});

export function createSupabaseStore(client: SupabaseClient): SupabaseRemote {
  const upsert: SupabaseRemote["upsert"] = async (items) => {
    for (let i = 0; i < items.length; i += BATCH) {
      const batch = items.slice(i, i + BATCH).map((x) => toRow(x.table, x.record));
      const { error } = await client.rpc("upsert_progress", { records: batch });
      if (error) throw new Error(`sync-push: ${error.message}`);
    }
  };

  async function selectAll(table: TableName): Promise<SyncRecord[]> {
    const out: SyncRecord[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await client
        .from("progress_records")
        .select("table_name,id,data,server_updated_at")
        .eq("table_name", table)
        .order("id")
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`sync-read: ${error.message}`);
      for (const row of (data ?? []) as Row[]) {
        const p = parseRow(row);
        if (p) out.push(p.record);
      }
      if (!data || data.length < PAGE) return out;
    }
  }

  return {
    async all(table) {
      return (await selectAll(table)) as TableMap[typeof table][];
    },
    async get(table, id) {
      const { data, error } = await client.from("progress_records").select("table_name,id,data,server_updated_at").eq("table_name", table).eq("id", id).maybeSingle();
      if (error) throw new Error(`sync-read: ${error.message}`);
      return ((data && parseRow(data as Row)?.record) ?? undefined) as TableMap[typeof table] | undefined;
    },
    async put(table, record) {
      await upsert([{ table, record }]);
    },
    async bulkPut(table, records) {
      await upsert(records.map((record) => ({ table, record })));
    },
    async clear() {
      // RLS restricts the delete to the caller's own rows.
      const { error } = await client.from("progress_records").delete().neq("id", "");
      if (error) throw new Error(`sync-clear: ${error.message}`);
    },
    // PostgREST has no client-side transactions; each batch is atomic on its own.
    atomic: (work) => work(),
    upsert,
    async pullSince(sinceIso) {
      const records: PulledRecord[] = [];
      let cursor = sinceIso;
      for (;;) {
        let q = client.from("progress_records").select("table_name,id,data,server_updated_at").order("server_updated_at").limit(PAGE);
        if (cursor) q = q.gt("server_updated_at", cursor);
        const { data, error } = await q;
        if (error) throw new Error(`sync-pull: ${error.message}`);
        const rows = (data ?? []) as Row[];
        for (const row of rows) {
          const p = parseRow(row);
          if (p) records.push(p);
        }
        if (rows.length > 0) cursor = rows[rows.length - 1]?.server_updated_at ?? cursor;
        if (rows.length < PAGE) return { records, cursor };
      }
    },
  };
}
