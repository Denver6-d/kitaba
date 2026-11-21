/**
 * Pure licence and attribution helpers for Wikimedia Commons files, read from
 * the API's `extmetadata` (the machine-readable licence template and the
 * Artist field of the file page).
 *
 * Allowed (owner's brief, DECISIONS AU4): CC0, CC BY (any version), CC BY-SA
 * (any version), and public domain. Everything else is refused, including
 * NC/ND variants, GFDL-only and Free Art files, unknown templates and any file
 * with a listed restriction. A file offered under several licences (GFDL and
 * CC BY-SA, common for old En-us files) is used under its CC licence.
 */

const field = (meta, k) => (typeof meta?.[k]?.value === "string" ? meta[k].value.trim() : "");

/** @returns {{ ok: true, code: string, short: string, url: string } | { ok: false, reason: string }} */
export function checkLicense(meta) {
  const code = field(meta, "License").toLowerCase();
  const short = field(meta, "LicenseShortName");
  const url = field(meta, "LicenseUrl").replace(/^http:/, "https:");
  if (field(meta, "Restrictions")) return { ok: false, reason: `restriction: ${field(meta, "Restrictions")}` };
  if (!code) return { ok: false, reason: "no machine-readable licence" };
  if (/(^|-)n[cd](-|$)/.test(code)) return { ok: false, reason: `non-commercial or no-derivatives: ${code}` };
  if (code === "cc0" || code === "cc-zero") return { ok: true, code: "cc0", short: "CC0 1.0", url: url || "https://creativecommons.org/publicdomain/zero/1.0/" };
  const by = /^cc-by(-sa)?-(\d(?:\.\d)?)(?:-[a-z]{2,3})?$/.exec(code);
  if (by) {
    if (!url) return { ok: false, reason: `no licence link for ${code}` };
    return { ok: true, code, short: short || `CC BY${by[1] ? "-SA" : ""} ${by[2]}`, url };
  }
  if (code === "pd" || code.startsWith("pd-")) return { ok: true, code: "pd", short: "Public domain", url: "" };
  return { ok: false, reason: `licence not allowed: ${code}` };
}

/** Plain text of an HTML fragment from the API (tags dropped, entities decoded, spaces collapsed). */
export function plainText(html) {
  return html
    .replace(/<li>/gi, "; ")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[;\s]+|[;\s]+$/g, "")
    .trim();
}

/**
 * The author to credit. Lingua Libre pages list "Speaker: X; Recorder: Y": the
 * speaker is credited, and the recorder too when it is someone else.
 */
export function authorOf(meta) {
  // Commons' own wording when the page has no author field: "No machine-readable author provided. X assumed (based on copyright claims)."
  const text = plainText(field(meta, "Artist"))
    .replace(/^No machine-readable author provided\.\s*(.+?)\s+assumed\b.*$/i, "$1")
    .replace(/^(?:user:|recorded by\s+)/i, "");
  const speaker = /Speaker:\s*([^;]+)/i.exec(text)?.[1]?.trim();
  const recorder = /Recorder:\s*([^;]+)/i.exec(text)?.[1]?.trim();
  if (speaker) return recorder && recorder !== speaker ? `${speaker} (recorded by ${recorder})` : speaker;
  return text;
}

/** The transcription a Lingua Libre record page states, or null. */
export function transcriptionOf(wikitext) {
  return /\|\s*transcription\s*=\s*([^\n|}]*)/.exec(wikitext)?.[1]?.trim() ?? null;
}
