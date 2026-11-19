/**
 * Parsers for VarCon and the CMU Pronouncing Dictionary (pure over text, so
 * they are unit-tested on small samples).
 */

/**
 * American → British pairs from varcon.txt. Only the plain "A" (American) and
 * "B" (British) tags are used. A spelling is ambiguous, and skipped, when some
 * sense of it is written the same in both (absinthe/absinth has two senses),
 * or when it has two different British forms (check: cheque, check).
 * @param {string} text
 * @returns {Map<string, string>}
 */
export function parseVarcon(text) {
  const pairs = new Map();
  const ambiguous = new Set();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split("|")[0].trim();
    if (!line || line.startsWith("#")) continue;
    let a = null;
    let b = null;
    for (const seg of line.split(" / ")) {
      const i = seg.indexOf(":");
      if (i < 0) continue;
      const tags = seg.slice(0, i).trim().split(/\s+/);
      const word = seg.slice(i + 1).trim();
      if (tags.includes("A")) a = word;
      if (tags.includes("B")) b = word;
    }
    if (!a || !b) continue;
    if (a === b) ambiguous.add(a);
    else if (pairs.has(a) && pairs.get(a) !== b) ambiguous.add(a);
    else pairs.set(a, b);
  }
  for (const a of ambiguous) pairs.delete(a);
  return pairs;
}

/**
 * word → pronunciations ("DH EH1 R"), from cmudict.dict. Alternative
 * pronunciations ("word(2)") are merged; trailing "# comments" are dropped.
 * @param {string} text
 * @returns {Map<string, string[]>}
 */
export function parseCmu(text) {
  const out = new Map();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split("#")[0].trim();
    if (!line) continue;
    const sp = line.indexOf(" ");
    if (sp < 0) continue;
    const word = line.slice(0, sp).replace(/\(\d+\)$/, "");
    const pron = line.slice(sp + 1).trim();
    if (!out.has(word)) out.set(word, []);
    out.get(word).push(pron);
  }
  return out;
}
