import type { CefrLevel, TableMap, TableName } from "@/domain/model";
import { dayKey } from "@/domain/progress/streak";
import type { ExportFile } from "@/repositories/export";
import { toCsv, type CsvTable, type CsvValue } from "@/lib/csv";

/**
 * Spreadsheet (CSV) views of the JSON export, for reading in Excel or Sheets.
 * Export only: the JSON file stays the backup that can be imported again.
 *
 * Three tables, one file each, because the stored data has three different
 * row shapes: words (SRS card + mastery), finished games, finished writings.
 * Only stored fields are written, plus plain derivations (a game's accuracy =
 * correct / items) and the word bank's own category and level for a word.
 */

export const CSV_TABLES = ["words", "games", "writings"] as const;
export type CsvTableName = (typeof CSV_TABLES)[number];

/** What the word bank or the open-data library knows about a word id. */
export interface WordInfo {
  readonly word: string;
  readonly category?: string | undefined;
  readonly level?: CefrLevel | undefined;
}

export interface CsvLabels {
  readonly headers: Readonly<Record<CsvTableName, readonly string[]>>;
  readonly category: (category: string) => string;
  readonly gameMode: (mode: string) => string;
  readonly writingMode: (mode: string) => string;
}

export interface CsvContext {
  readonly lookup: (wordId: string) => WordInfo | undefined;
  readonly labels: CsvLabels;
}

const MASTERY_PREFIX = "spell:";
/** Joins several values inside one cell (missed words, corrections). */
const LIST_SEPARATOR = "; ";

/** Local calendar date, YYYY-MM-DD; empty for "never" (0). */
const isoDay = (ms: number): string => (ms > 0 ? dayKey(new Date(ms)) : "");

const percent = (ratio: number): number => Math.round(ratio * 100);

/**
 * The live (not deleted) rows of a table, typed. Safe: an ExportFile comes from
 * exportAll() or from parseExportFile, which validates every row per table.
 */
function live<T extends TableName>(file: ExportFile, table: T): TableMap[T][] {
  return (file.tables[table] as readonly TableMap[T][]).filter((r) => r.deletedAt === undefined);
}

/** Word ids that appear in the CSV tables (to look up the open-data library ones). */
export function referencedWordIds(file: ExportFile): string[] {
  const ids = new Set<string>();
  for (const c of live(file, "srs")) ids.add(c.wordId);
  for (const m of live(file, "mastery")) if (m.id.startsWith(MASTERY_PREFIX)) ids.add(m.id.slice(MASTERY_PREFIX.length));
  for (const s of live(file, "sessions")) for (const id of s.missed) ids.add(id);
  return [...ids];
}

export function buildCsvTable(name: CsvTableName, file: ExportFile, ctx: CsvContext): CsvTable {
  const header = ctx.labels.headers[name];
  switch (name) {
    case "words":
      return { header, rows: wordRows(file, ctx) };
    case "games":
      return { header, rows: gameRows(file, ctx) };
    case "writings":
      return { header, rows: writingRows(file, ctx) };
  }
}

export function buildCsv(name: CsvTableName, file: ExportFile, ctx: CsvContext): string {
  return toCsv(buildCsvTable(name, file, ctx));
}

/** kitaba-progress-<table>-YYYY-MM-DD.csv (local date). */
export const csvFilename = (name: CsvTableName, now = new Date()): string => `kitaba-progress-${name}-${dayKey(now)}.csv`;

function wordRows(file: ExportFile, { lookup, labels }: CsvContext): CsvValue[][] {
  const cards = new Map(live(file, "srs").map((c) => [c.wordId, c]));
  const mastery = new Map<string, number>();
  for (const m of live(file, "mastery")) if (m.id.startsWith(MASTERY_PREFIX)) mastery.set(m.id.slice(MASTERY_PREFIX.length), m.mastery);

  const rows = [...new Set([...cards.keys(), ...mastery.keys()])].map((id) => {
    const card = cards.get(id);
    const info = lookup(id);
    const word = info?.word ?? card?.word ?? id;
    const cells: CsvValue[] = [
      word,
      info?.category ? labels.category(info.category) : "",
      info?.level ?? "",
      card?.lapses,
      card?.reps,
      mastery.get(id),
      card?.interval,
      card ? isoDay(card.lastReviewed) : "",
      card ? isoDay(card.due) : "",
      card?.context,
    ];
    return { due: card?.due ?? Number.POSITIVE_INFINITY, word, cells };
  });
  // Next review first; words without a card (never missed) last, alphabetically.
  rows.sort((a, b) => (a.due === b.due ? a.word.localeCompare(b.word, "en") : a.due < b.due ? -1 : 1));
  return rows.map((r) => r.cells);
}

function gameRows(file: ExportFile, { lookup, labels }: CsvContext): CsvValue[][] {
  return live(file, "sessions")
    .sort((a, b) => a.at - b.at)
    .map((s) => [
      isoDay(s.at),
      labels.gameMode(s.mode),
      s.stageId,
      s.items,
      s.correct,
      s.items > 0 ? percent(s.correct / s.items) : "",
      s.points,
      s.maxCombo,
      s.seconds,
      s.missed.map((id) => lookup(id)?.word ?? id).join(LIST_SEPARATOR),
    ]);
}

function writingRows(file: ExportFile, { labels }: CsvContext): CsvValue[][] {
  return live(file, "writings")
    .sort((a, b) => a.at - b.at)
    .map((w) => [
      isoDay(w.at),
      labels.writingMode(w.mode),
      w.level,
      w.words,
      w.mistakes,
      percent(w.accuracy),
      w.stars,
      w.missed.map((m) => (m.right ? `${m.wrong} → ${m.right}` : m.wrong)).join(LIST_SEPARATOR),
      w.text,
    ]);
}
