import { describe, expect, it } from "vitest";
import { CSV_BOM } from "@/lib/csv";
import { EXPORT_VERSION, type ExportFile } from "@/repositories/export";
import { TABLE_NAMES, type SessionRecord, type SrsCardRecord, type SyncRecord, type TableName, type WritingRecord } from "@/domain/model";
import { dayKey } from "@/domain/progress/streak";
import { ar } from "@/i18n/ar";
import { en } from "@/i18n/en";
import { buildCsv, buildCsvTable, CSV_TABLES, csvFilename, referencedWordIds, type CsvContext } from "@/features/export/progress-csv";

const DAY = 86_400_000;
const T0 = new Date(2026, 10, 20, 12).getTime(); // local noon: same calendar day in any time zone offset

function file(tables: Partial<Record<TableName, SyncRecord[]>>): ExportFile {
  const all = Object.fromEntries(TABLE_NAMES.map((n) => [n, tables[n] ?? []])) as Record<TableName, SyncRecord[]>;
  return { app: "kitaba", version: EXPORT_VERSION, exportedAt: T0, tables: all };
}

const card = (wordId: string, over: Partial<SrsCardRecord> = {}): SrsCardRecord => ({
  id: wordId,
  updatedAt: T0,
  wordId,
  ease: 2.5,
  interval: 6,
  reps: 2,
  lapses: 1,
  due: T0 + 6 * DAY,
  lastReviewed: T0,
  ...over,
});

const session = (over: Partial<SessionRecord> = {}): SessionRecord => ({
  id: "s1",
  updatedAt: T0,
  mode: "listen",
  stageId: null,
  items: 10,
  correct: 7,
  points: 120,
  maxCombo: 4,
  seconds: 95,
  at: T0,
  missed: ["w-because", "w-unknown"],
  ...over,
});

const writing = (over: Partial<WritingRecord> = {}): WritingRecord => ({
  id: "wr1",
  updatedAt: T0,
  mode: "free",
  sourceId: "email-friend",
  level: "A2",
  text: "Hi,\nI recieved \"your\" letter.",
  words: 5,
  mistakes: 1,
  accuracy: 0.8,
  stars: 2,
  at: T0,
  missed: [
    { wrong: "recieved", right: "received", type: "ie-ei" },
    { wrong: "teh", right: null, type: "unknown" },
  ],
  ...over,
});

const ctx: CsvContext = {
  lookup: (id) => (id === "w-because" ? { word: "because", category: "common", level: "A1" } : undefined),
  labels: {
    headers: ar.settings.csv.headers,
    category: (c) => (c === "common" ? "كلمات يكثر الخطأ فيها" : c),
    gameMode: (m) => ar.modes[m]?.name ?? m,
    writingMode: (m) => ar.writing.modeNames[m] ?? m,
  },
};

describe("progress CSV tables", () => {
  it("headers have the same number of columns in Arabic and English", () => {
    for (const name of CSV_TABLES) expect(ar.settings.csv.headers[name]).toHaveLength(en.settings.csv.headers[name].length);
  });

  it("empty data gives header-only files with a BOM", () => {
    for (const name of CSV_TABLES) {
      const csv = buildCsv(name, file({}), ctx);
      expect(csv.startsWith(CSV_BOM)).toBe(true);
      expect(csv.slice(1).split("\r\n").filter(Boolean)).toHaveLength(1);
      expect(buildCsvTable(name, file({}), ctx).rows).toEqual([]);
    }
  });

  it("words: one row per word from SRS cards and mastery, with Arabic labels and ISO dates", () => {
    const f = file({
      srs: [card("w-because", { context: "=cmd" })],
      mastery: [
        { id: "spell:w-because", updatedAt: T0, mastery: 3 } as SyncRecord,
        { id: "spell:w-known", updatedAt: T0, mastery: 5 } as SyncRecord,
      ],
    });
    const { header, rows } = buildCsvTable("words", f, ctx);
    expect(rows.every((r) => r.length === header.length)).toBe(true);
    expect(rows[0]).toEqual(["because", "كلمات يكثر الخطأ فيها", "A1", 1, 2, 3, 6, dayKey(new Date(T0)), dayKey(new Date(T0 + 6 * DAY)), "=cmd"]);
    expect(rows[0]?.[7]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // A word with mastery but no card: no SRS data, unknown spelling falls back to its id.
    expect(rows[1]).toEqual(["w-known", "", "", undefined, undefined, 5, undefined, "", "", undefined]);
    // The context cell is neutralised in the file.
    expect(buildCsv("words", f, ctx)).toContain(",'=cmd\r\n");
  });

  it("words: a card for a word outside the bank uses its stored spelling", () => {
    const { rows } = buildCsvTable("words", file({ srs: [card("x-recieve", { word: "recieve", lastReviewed: 0 })] }), ctx);
    expect(rows[0]?.[0]).toBe("recieve");
    expect(rows[0]?.[7]).toBe(""); // never reviewed
  });

  it("words: sorted by next review, deleted cards left out", () => {
    const f = file({
      srs: [
        card("w-late", { due: T0 + 30 * DAY }),
        card("w-soon", { due: T0 + DAY }),
        card("w-gone", { deletedAt: T0 }),
      ],
    });
    expect(buildCsvTable("words", f, ctx).rows.map((r) => r[0])).toEqual(["w-soon", "w-late"]);
  });

  it("games: date, Arabic mode name, accuracy and missed words", () => {
    const { rows } = buildCsvTable("games", file({ sessions: [session(), session({ id: "s0", at: T0 - DAY, items: 0, correct: 0, missed: [] })] }), ctx);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.[0]).toBe(dayKey(new Date(T0 - DAY))); // oldest first
    expect(rows[0]?.[5]).toBe(""); // no items: no accuracy
    expect(rows[1]).toEqual([dayKey(new Date(T0)), "استمع واكتب", null, 10, 7, 70, 120, 4, 95, "because; w-unknown"]);
  });

  it("writings: corrections and multi-line text survive quoting", () => {
    const csv = buildCsv("writings", file({ writings: [writing()] }), ctx);
    expect(csv).toContain(`,كتابة حرة,A2,5,1,80,2,recieved → received; teh,"Hi,\nI recieved ""your"" letter."\r\n`);
  });

  it("referencedWordIds collects card, mastery and missed ids once", () => {
    const f = file({ srs: [card("w-a")], mastery: [{ id: "spell:w-b", updatedAt: T0, mastery: 1 } as SyncRecord], sessions: [session({ missed: ["w-a", "w-c"] })] });
    expect(referencedWordIds(f).sort()).toEqual(["w-a", "w-b", "w-c"]);
  });

  it("file names use the table and an ISO date", () => {
    expect(csvFilename("words", new Date(2026, 10, 22, 9))).toBe("kitaba-progress-words-2026-11-22.csv");
    expect(csvFilename("writings", new Date(2026, 0, 5))).toBe("kitaba-progress-writings-2026-01-05.csv");
  });
});
