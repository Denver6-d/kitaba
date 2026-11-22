/**
 * Minimal RFC 4180 CSV writer for spreadsheet export (no dependency).
 *
 * - UTF-8 with a byte order mark, so Excel opens Arabic text correctly.
 * - CRLF line endings; a cell is quoted when it holds a comma, quote, CR or
 *   LF (or leading/trailing spaces), and quotes inside it are doubled.
 * - Formula injection (OWASP "CSV injection"): a text cell starting with
 *   =, +, -, @, tab or carriage return gets a leading apostrophe, so a
 *   spreadsheet shows it as text instead of running it.
 */

export type CsvValue = string | number | null | undefined;

export const CSV_BOM = "﻿";
export const CSV_MIME = "text/csv;charset=utf-8";

const FORMULA_START = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\r\n]|^\s|\s$/;

/** Prefixes an apostrophe to text a spreadsheet would treat as a formula. */
export function neutraliseFormula(text: string): string {
  return FORMULA_START.test(text) ? `'${text}` : text;
}

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  // Numbers are written with Western digits and a dot; non-finite values are left empty.
  if (typeof value === "number" && !Number.isFinite(value)) return "";
  // Every cell is checked, numbers too: the rule is about what the cell starts with.
  const text = neutraliseFormula(String(value));
  return NEEDS_QUOTES.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export interface CsvTable {
  readonly header: readonly string[];
  readonly rows: readonly (readonly CsvValue[])[];
}

/** The whole file as text, BOM first. An empty table still has its header row. */
export function toCsv(table: CsvTable): string {
  const lines = [table.header, ...table.rows].map((row) => row.map(csvCell).join(","));
  return `${CSV_BOM}${lines.join("\r\n")}\r\n`;
}
