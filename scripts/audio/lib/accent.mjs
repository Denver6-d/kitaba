/**
 * Pure helpers that read accent labels. English Wiktionary editors label each
 * pronunciation file with its accent when they add it to an entry:
 *   * {{audio|en|LL-Q1860 (eng)-Vealhurl-apple.wav|a=Southern England}}
 * Lingua Libre itself no longer publishes speaker details, so these labels are
 * the evidence used to decide whether a speaker's recordings are American.
 */

const US = /\b(GA|US|USA|U\.S\.|General American|GenAm|Gen Am|American|Ameri|California|Texas|New York|NYC|Midwest|Inland North|Boston|Philadelphia|Chicago|Ohio|Minnesota|Michigan|Pennsylvania|New Jersey|Oregon|Washington|Virginia|Carolina|Georgia US|Florida|Wisconsin|Colorado|Utah|Southern US)\b/i;
const UK = /\b(RP|SSB|UK|British|Britain|England|English|London|Scotland|Scottish|Wales|Welsh|Received Pronunciation|Estuary|Yorkshire|Northern England|Southern England)\b/i;
const OTHER = /\b(Canada|Canadian|CA|AU|Australia|Australian|NZ|New Zealand|Ireland|Irish|India|Indian|South Africa|Singapore|Nigeria|Philippines|Jamaica|Malaysia|Kenya|Pakistan)\b/i;

/** "us" | "uk" | "other" | null for a label written by a Wiktionary editor. */
export function classifyAccentLabel(label) {
  const l = label.trim();
  if (!l) return null;
  // Order matters: "Canada" and "Ireland" are not US or UK even when the label also says "English".
  if (OTHER.test(l)) return "other";
  const us = US.test(l);
  const uk = UK.test(l);
  if (us && !uk) return "us";
  if (uk && !us) return "uk";
  return null;
}

/**
 * The accent labels Wiktionary gives one file on one page:
 * every {{audio|en|<file>|...|a=<label>}} line naming it.
 */
export function labelsForFile(wikitext, file) {
  const out = [];
  const want = file.replaceAll("_", " ");
  for (const m of wikitext.matchAll(/\{\{\s*audio\s*\|\s*en\s*\|([^}]*)\}\}/gi)) {
    const parts = m[1].split("|").map((p) => p.trim());
    if (parts[0]?.replaceAll("_", " ") !== want) continue;
    for (const p of parts.slice(1)) {
      const a = /^a\s*=\s*(.+)$/.exec(p);
      if (a) out.push(...a[1].split(",").map((s) => s.trim()).filter(Boolean));
    }
  }
  return out;
}

/**
 * A speaker's accent from the labels of their files: at least `min` labelled
 * files, and at least 80% of the votes for one accent. Otherwise null (unknown):
 * an unknown speaker is never used.
 */
export function speakerAccent(votes, min = 3) {
  const counts = { us: 0, uk: 0, other: 0 };
  for (const v of votes) if (v) counts[v]++;
  const total = counts.us + counts.uk + counts.other;
  if (total < min) return null;
  for (const k of ["us", "uk", "other"]) if (counts[k] / total >= 0.8) return k;
  return null;
}
