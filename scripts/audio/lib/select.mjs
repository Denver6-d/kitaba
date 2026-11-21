/**
 * The source choice for one word (pure). Order (owner's brief):
 *   1. a human recording with an allowed licence: an En-us- file first (the
 *      long-standing US naming on Commons), then a Lingua Libre recording by a
 *      speaker known to be American (04-speakers);
 *   2. otherwise the offline neural voice ("tts");
 *   3. the app falls back to Web Speech when neither produced a file.
 * Candidates that fail any check are listed with the reason, for the report.
 */
import { authorOf, checkLicense, transcriptionOf } from "./license.mjs";

/** Raw durations outside this range (seconds) are not a single spoken word. */
export const RAW_SECONDS = { min: 0.15, max: 6 };
/** An author credit longer than this many words is not a name. */
export const MAX_AUTHOR_WORDS = 6;

/**
 * @param {string} word
 * @param {{ title: string, kind: "en-us" | "lingualibre", speaker?: string }[]} candidates in preference order
 * @param {(title: string) => ({ meta: object, url: string, page: string, duration?: number, bytes?: number, mime?: string, wikitext?: string } | undefined)} info
 */
export function chooseSources(word, candidates, info) {
  const usable = [];
  const rejected = [];
  for (const c of candidates) {
    const i = info(c.title);
    if (!i) {
      rejected.push({ title: c.title, reason: "no file information" });
      continue;
    }
    const lic = checkLicense(i.meta);
    if (!lic.ok) {
      rejected.push({ title: c.title, reason: lic.reason });
      continue;
    }
    if (c.kind === "lingualibre") {
      // Older records use a bare {{Lingua Libre record}}: their file name is the transcription,
      // and the speaker part of the name is a known speaker, so the word part is unambiguous.
      const said = i.wikitext === undefined ? null : transcriptionOf(i.wikitext);
      const bare = said === null && /\{\{\s*Lingua Libre record\s*\}\}/i.test(i.wikitext ?? "");
      if (said !== word && !bare) {
        rejected.push({ title: c.title, reason: `transcription is ${JSON.stringify(said)}` });
        continue;
      }
    }
    if (typeof i.duration === "number" && (i.duration < RAW_SECONDS.min || i.duration > RAW_SECONDS.max)) {
      rejected.push({ title: c.title, reason: `duration ${i.duration.toFixed(2)} s` });
      continue;
    }
    const author = authorOf(i.meta);
    if (!author && lic.code !== "pd" && lic.code !== "cc0") {
      rejected.push({ title: c.title, reason: "no author to credit" });
      continue;
    }
    // A vandalised description page can put a sentence in the author field: do not credit (or use) it.
    if (author.split(/\s+/).length > MAX_AUTHOR_WORDS) {
      rejected.push({ title: c.title, reason: "author field is not a name" });
      continue;
    }
    usable.push({ title: c.title, kind: c.kind, url: i.url, page: i.page, author: author || "unknown", license: lic.short, licenseUrl: lic.url });
  }
  return { usable, rejected };
}

/** Candidate titles for one word, in preference order. */
export function candidatesFor(word, { enUs, lingualibre, speakerAccent, speakerRank }) {
  const out = [];
  // Ogg first: the original En-us uploads are Ogg; later re-uploads in other formats are rarer.
  for (const name of [...(enUs.get(word) ?? [])].sort((a, b) => Number(!/\.og[ga]$/i.test(a)) - Number(!/\.og[ga]$/i.test(b)) || a.localeCompare(b))) out.push({ title: `File:${name}`, kind: "en-us" });
  const ll = (lingualibre.get(word) ?? []).filter((f) => speakerAccent(f.speaker) === "us");
  ll.sort((a, b) => speakerRank(a.speaker) - speakerRank(b.speaker) || a.name.localeCompare(b.name));
  for (const f of ll) out.push({ title: `File:${f.name}`, kind: "lingualibre", speaker: f.speaker });
  return out;
}
