/**
 * Pure helpers that match Commons file names to words.
 *   En-us-<word>.<ext>, En-uk-<word>.<ext>
 *   LL-Q1860 (eng)-<speaker>-<word>.wav   (a speaker name may contain hyphens)
 * Matching is exact and case-sensitive on the word: "En-us-Polish.ogg" is not
 * "polish". Lingua Libre names are matched against the target words, and the
 * transcription on the file page is checked again before use (05-select).
 */

export const AUDIO_EXT = /\.(ogg|oga|wav|mp3|flac|opus)$/i;

/** word -> [file name] for En-us- / En-uk- files. */
export function prefixedByWord(files, prefix, words) {
  const out = new Map();
  for (const f of files) {
    if (!f.name.startsWith(prefix) || !AUDIO_EXT.test(f.name)) continue;
    const word = f.name.slice(prefix.length).replace(AUDIO_EXT, "");
    if (!words.has(word)) continue;
    const list = out.get(word) ?? [];
    list.push(f.name);
    out.set(word, list);
  }
  return out;
}

const LL = /^LL-Q1860 \(eng\)-(.+)\.wav$/;

/** word -> [{ speaker, name }] for Lingua Libre files whose name ends in "-<word>.wav". */
export function lingualibreByWord(files, words) {
  const out = new Map();
  for (const f of files) {
    const m = LL.exec(f.name);
    if (!m) continue;
    const rest = m[1];
    for (let i = rest.indexOf("-"); i > 0; i = rest.indexOf("-", i + 1)) {
      const word = rest.slice(i + 1);
      if (!words.has(word)) continue;
      const list = out.get(word) ?? [];
      list.push({ speaker: rest.slice(0, i), name: f.name });
      out.set(word, list);
    }
  }
  return out;
}
