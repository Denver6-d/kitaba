/**
 * Step 04: the graded word library.
 *
 * - Rank: Tatoeba token frequency (step 03) over the checked lexicon (step 02).
 *   The top LIMIT words are kept, counting the hand-written bank, so the rank is
 *   a true frequency rank. Words under three letters are left out (no spelling
 *   to practise).
 * - Level: by rank band (BANDS), nudged by the SCOWL size: a word that SCOWL
 *   only lists at size 50 or above is never easier than B2.
 * - Category: rule-based (lib/classify.mjs), using VarCon for British forms and
 *   CMUdict for homophones and silent letters.
 * - The 1,591 hand-written words keep everything they have; the library only
 *   adds words that are not in the bank. Agreement of the classifier and the
 *   bands with the bank is reported, not forced.
 *
 * Output: content-raw/work/words.json and report-words.json (git-ignored).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, runStep, writeJson } from "./lib/checkpoint.mjs";
import { classify, homophoneGroups } from "./lib/classify.mjs";
import { BANDS, LEVELS, levelFor } from "./lib/levels.mjs";
import { DOWNLOADS, EXTRACTED, WORK } from "./lib/paths.mjs";
import { parseCmu, parseVarcon } from "./lib/sources.mjs";
import { loadBank, spellChecker } from "./lib/text.mjs";
import { LEXICON } from "./02-lexicon.mjs";
import { FREQUENCY } from "./03-frequency.mjs";

const SCRIPT = fileURLToPath(import.meta.url);
export const WORDS = join(WORK, "words.json");
export const WORDS_REPORT = join(WORK, "report-words.json");
const VARCON = join(EXTRACTED, "varcon", "varcon", "varcon-2020.12.07", "varcon.txt");
const CMU = join(DOWNLOADS, "cmudict", "cmudict.dict");
const BANK_DIR = join(fileURLToPath(new URL("../../src/data/words", import.meta.url)));

export const LIMIT = 20_000;
export const MIN_COUNT = 3;
/** Both words of a homophone pair must be at least this common (or in the bank). */
export const HOMOPHONE_MAX_RANK = 10_000;
/** British forms that depend on the meaning (G1): never offered as a variant. */
const MEANING_DEPENDENT = new Set(["check", "story", "program", "tire", "draft", "curb", "practice", "license", "meter", "disk", "inquiry", "gray"]);

function distance(a, b) {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return d[b.length];
}

export async function run({ force = false } = {}) {
  const inputs = [LEXICON, FREQUENCY, VARCON, CMU, fileURLToPath(new URL("./lib/classify.mjs", import.meta.url)), fileURLToPath(new URL("./lib/levels.mjs", import.meta.url))];
  const { result } = await runStep(WORK, "words", { script: SCRIPT, inputs, outputs: [WORDS, WORDS_REPORT], options: { LIMIT, MIN_COUNT, BANDS, HOMOPHONE_MAX_RANK, bank: BANK_DIR }, force }, async () => {
    const lexicon = new Map(readJson(LEXICON).words);
    const { counts } = readJson(FREQUENCY);
    const bank = await loadBank();
    const bankSpellings = new Set(bank.flatMap((w) => (w.uk ? [w.word, w.uk] : [w.word])));
    const cmu = parseCmu(readFileSync(CMU, "utf8"));
    const spell = spellChecker();

    // British forms: VarCon A/B pairs that are small edits, not meaning-dependent, and not American words in their own right.
    const varcon = parseVarcon(readFileSync(VARCON, "latin1"));
    const ukOf = new Map();
    for (const [a, b] of varcon) {
      if ([...MEANING_DEPENDENT].some((m) => a.startsWith(m.replace(/e$/, ""))) || !/^[a-z]+(?:-[a-z]+)*$/.test(b) || distance(a, b) > 4) continue;
      // British English also writes learned, spilled, dreamed: the -t forms are not a required variant (G-7).
      if (/ed$/.test(a) && /t$/.test(b)) continue;
      if (lexicon.has(b) || spell.correct(b)) continue;
      ukOf.set(a, b);
    }

    const ranked = [...lexicon.keys()].filter((w) => (counts[w] ?? 0) >= MIN_COUNT).sort((a, b) => counts[b] - counts[a] || lexicon.get(a) - lexicon.get(b) || a.localeCompare(b));
    const rejected = { "under three letters": [], "spelling is a bank word's British form": [] };
    const selected = [];
    for (const w of ranked) {
      if (selected.length >= LIMIT) break;
      if (w.length < 3) rejected["under three letters"].push(w);
      else selected.push(w);
    }
    const rank = new Map(selected.map((w, i) => [w, i + 1]));
    const prons = (w) => cmu.get(w) ?? [];
    // Homophones: primary pronunciations of frequent words only, so "the" is not paired with "thee".
    const homophonePool = new Set([...selected.filter((w) => rank.get(w) <= HOMOPHONE_MAX_RANK), ...bankSpellings]);
    const isVariant = (a, b) => ukOf.get(a) === b || ukOf.get(b) === a;
    const homophones = homophoneGroups(homophonePool, (w) => prons(w).slice(0, 1), isVariant);
    const ctx = { has: (w) => lexicon.has(w), prons, uk: (w) => ukOf.get(w), homophones: (w) => homophones.get(w) ?? [] };

    const words = [];
    for (const w of selected) {
      if (bankSpellings.has(w)) {
        if (!bank.some((b) => b.word === w)) rejected["spelling is a bank word's British form"].push(w);
        continue;
      }
      const uk = ukOf.get(w);
      if (uk && bankSpellings.has(uk)) continue;
      const category = classify(w, ctx);
      const confusables = category === "homophones" ? ctx.homophones(w).sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0)).slice(0, 3) : undefined;
      // A homophone is spoken with its example; without one it is played under its next category (publish step).
      const fallback = confusables ? classify(w, { ...ctx, homophones: () => [] }) : undefined;
      words.push({ word: w, ...(uk ? { uk } : {}), level: levelFor(rank.get(w), lexicon.get(w)), category, rank: rank.get(w), ...(confusables ? { confusables, fallback } : {}) });
    }

    // Agreement with the hand-written bank (reported, not forced).
    const agreement = { category: 0, level: 0, levelWithinOne: 0, ranked: 0, total: bank.length, byCategory: {} };
    for (const b of bank) {
      const got = classify(b.word, ctx);
      const row = (agreement.byCategory[b.category] ??= { total: 0, same: 0, got: {} });
      row.total++;
      row.got[got] = (row.got[got] ?? 0) + 1;
      if (got === b.category) {
        agreement.category++;
        row.same++;
      }
      if (rank.has(b.word)) {
        agreement.ranked++;
        const l = levelFor(rank.get(b.word), lexicon.get(b.word) ?? 60);
        if (l === b.level) agreement.level++;
        if (Math.abs(LEVELS.indexOf(l) - LEVELS.indexOf(b.level)) <= 1) agreement.levelWithinOne++;
      }
    }

    const tally = (key) => Object.fromEntries([...new Set(words.map((w) => w[key]))].sort().map((k) => [k, words.filter((w) => w[key] === k).length]));
    const report = {
      lexicon: lexicon.size,
      withFrequency: ranked.length,
      library: words.length,
      ukPairs: ukOf.size,
      homophoneWords: [...homophones.keys()].length,
      byLevel: tally("level"),
      byCategory: tally("category"),
      rejected: Object.fromEntries(Object.entries(rejected).map(([k, v]) => [k, { count: v.length, samples: v.slice(0, 15) }])),
      agreement,
    };
    writeJson(WORDS, { $comment: "Library words (not in the hand-written bank). Generated by 04-words.mjs.", words });
    writeJson(WORDS_REPORT, report);
    return { library: words.length, byLevel: report.byLevel, categoryAgreement: `${agreement.category}/${agreement.total}`, levelWithinOne: `${agreement.levelWithinOne}/${agreement.ranked}` };
  });
  return result;
}
