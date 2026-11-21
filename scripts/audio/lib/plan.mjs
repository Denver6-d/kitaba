/**
 * Pure helpers for the two audio layers (DECISIONS AU12):
 *   - the generated layer: every target word gets a file now, from a human
 *     recording already on disk, else the offline voice;
 *   - the human layer: a slow, resumable run downloads the remaining human
 *     recordings and replaces generated files as they arrive.
 */

/** `tried` lines are "<title>: <reason>", written by 07-render. */
const refused = (title, tried) => tried.some((t) => t.startsWith(`${title}: `));

/** Usable candidates not yet refused for this word, in preference order. */
export function remainingCandidates(usable, tried = []) {
  return usable.filter((c) => !refused(c.title, tried));
}

export const isHuman = (entry) => entry?.src === "en-us" || entry?.src === "lingualibre";

/**
 * The candidates to try now. Online: every remaining one (render downloads
 * them). Offline: the remaining ones already on disk, up to the first that is
 * not, so the preference order is kept (a better recording that has not
 * arrived yet is waited for, not skipped).
 */
export function candidatesToTry(remaining, { offline, onDisk }) {
  if (!offline) return remaining;
  const out = [];
  for (const c of remaining) {
    if (!onDisk(c)) break;
    out.push(c);
  }
  return out;
}

/**
 * What render does with one word:
 *   "skip"    a human file exists, or a generated one with nothing left to try now;
 *   "try"     try human candidates (then keep or make the generated file);
 *   "voice"   no candidate to try now and no file: make the generated file.
 */
export function wordAction(entry, { fileExists, toTry }) {
  if (isHuman(entry) && fileExists) return "skip";
  if (toTry.length) return "try";
  if (entry?.src === "tts" && fileExists) return "skip";
  if (entry?.src === "none") return "skip";
  return "voice";
}

/** A generated (or missing) word still waiting for a human recording. */
export function isPendingHuman(entry, usable) {
  return !isHuman(entry) && remainingCandidates(usable, entry?.tried ?? []).length > 0;
}
