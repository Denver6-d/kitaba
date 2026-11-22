import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { PROGRESS_RECORD_MAX_BYTES, PROGRESS_RECORD_PUSH_MAX_BYTES, WRITING_MISSED_MAX, WRITING_TEXT_MAX, type SyncRecord } from "@/domain/model";
import { createSupabaseStore, fitsServerCap } from "@/repositories/supabase/store";

/** Security review findings 2 and 6 (DECISIONS SEC2). */
const hardening = readFileSync(new URL("../../supabase/migrations/20261122000001_security_hardening.sql", import.meta.url), "utf8");

function fakeClient() {
  const calls: unknown[][] = [];
  const client = {
    rpc: async (_name: string, args: { records: unknown[] }) => {
      calls.push(args.records);
      return { data: args.records.length, error: null };
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

const writing = (id: string, text: string): SyncRecord =>
  ({
    id,
    updatedAt: 1,
    mode: "free",
    sourceId: "s1",
    level: "B1",
    text,
    words: 1,
    mistakes: WRITING_MISSED_MAX,
    accuracy: 0.5,
    stars: 1,
    at: 1,
    missed: Array.from({ length: WRITING_MISSED_MAX }, () => ({ wrong: "w".repeat(20), right: "r".repeat(20), type: "spelling" })),
  }) as unknown as SyncRecord;

describe("record size cap", () => {
  it("matches the SQL check constraint", () => {
    expect(hardening).toContain(`octet_length(data::text) <= ${PROGRESS_RECORD_MAX_BYTES}`);
  });

  it("leaves room for the spaces Postgres adds when it prints jsonb", () => {
    expect(PROGRESS_RECORD_MAX_BYTES - PROGRESS_RECORD_PUSH_MAX_BYTES).toBeGreaterThanOrEqual(1024);
  });

  it("fits the largest real writing: 4,000 characters and 50 marked mistakes", () => {
    expect(fitsServerCap(writing("w", "a".repeat(WRITING_TEXT_MAX)))).toBe(true);
  });

  it("never pushes an oversized record, so it cannot stall the batch", async () => {
    const { client, calls } = fakeClient();
    const store = createSupabaseStore(client);
    const big = writing("big", "م".repeat(WRITING_TEXT_MAX * 2)); // 8,000 two-byte letters
    expect(fitsServerCap(big)).toBe(false);
    await store.upsert([
      { table: "writings", record: writing("ok", "fine") },
      { table: "writings", record: big },
    ]);
    expect(calls).toHaveLength(1);
    expect((calls[0] as Array<{ id: string }>).map((r) => r.id)).toEqual(["ok"]);
  });
});
