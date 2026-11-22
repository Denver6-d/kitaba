import { CSV_MIME } from "./csv";

/** Triggers a file download for in-memory data (no server involved). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadJson(data: unknown, filename: string): void {
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), filename);
}

/** CSV text (already starting with its BOM) as a UTF-8 file. */
export function downloadCsv(csv: string, filename: string): void {
  downloadBlob(new Blob([csv], { type: CSV_MIME }), filename);
}

export const exportFilename = (prefix = "kitaba-progress") => `${prefix}-${new Date().toISOString().slice(0, 10)}.json`;
