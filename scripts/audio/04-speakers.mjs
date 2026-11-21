/**
 * Step 04 (speakers): decides which Lingua Libre speakers are American (or
 * British), from the accent labels English Wiktionary editors put on their
 * files (lib/accent.mjs). For each speaker with recordings of target words,
 * up to SAMPLE of those words' Wiktionary entries are read (wikitext only).
 * A speaker with too few labels, or mixed labels, stays unknown and is never
 * used.
 *
 * Resumable: every speaker's votes are written to content-raw/audio/ as soon as
 * they are read. The result is also written to scripts/audio/speakers.json
 * (committed), so the choice can be reviewed and repeated.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { readJson, writeJson } from "../content/lib/checkpoint.mjs";
import { classifyAccentLabel, labelsForFile, speakerAccent } from "./lib/accent.mjs";
import { get } from "./lib/commons.mjs";
import { lingualibreByWord } from "./lib/names.mjs";
import { PIPELINE, RAW } from "./lib/paths.mjs";
import { TARGETS } from "./02-targets.mjs";
import { readIndex } from "./03-index.mjs";

const STATE = join(RAW, "speakers-state.json");
export const SPEAKERS = join(PIPELINE, "speakers.json");
/** Speakers with fewer target words than this are not worth a lookup. */
const MIN_WORDS = 3;
/** Wiktionary entries read per speaker. */
const SAMPLE = 10;

export async function run({ force = false } = {}) {
  const targets = readJson(TARGETS);
  const words = new Set(targets.map((t) => t.word));
  const ll = lingualibreByWord(readIndex("lingualibre"), words);
  const bySpeaker = new Map();
  for (const [word, list] of ll) for (const { speaker, name } of list) bySpeaker.set(speaker, [...(bySpeaker.get(speaker) ?? []), { word, name }]);

  const state = !force && existsSync(STATE) ? readJson(STATE) : { speakers: {} };
  const todo = [...bySpeaker].filter(([s, files]) => files.length >= MIN_WORDS && !state.speakers[s]).sort((a, b) => b[1].length - a[1].length);
  for (const [speaker, files] of todo) {
    const votes = [];
    const labels = [];
    // Spread the sample over the speaker's words (not only the first ones alphabetically).
    const step = Math.max(1, Math.floor(files.length / SAMPLE));
    for (let i = 0; i < files.length && labels.length < SAMPLE * 2 && i / step < SAMPLE; i += step) {
      const { word, name } = files[i];
      let text = "";
      try {
        text = await (await get(`https://en.wiktionary.org/w/index.php?title=${encodeURIComponent(word)}&action=raw`, { tries: 3 })).text();
      } catch {
        continue; // no entry: no evidence
      }
      for (const l of labelsForFile(text, name)) {
        labels.push(l);
        votes.push(classifyAccentLabel(l));
      }
    }
    state.speakers[speaker] = { words: files.length, labels };
    writeJson(STATE, state);
    console.log(`  ${speaker}: ${speakerAccent(votes) ?? "unknown"} (${labels.length} labels)`);
  }

  // The accent is recomputed from the stored labels, so a change to the label rules needs no new lookups.
  const summary = Object.fromEntries(
    Object.entries(state.speakers)
      .sort((a, b) => b[1].words - a[1].words)
      .map(([s, v]) => [s, { accent: speakerAccent(v.labels.map(classifyAccentLabel)), labels: v.labels.length, sample: [...new Set(v.labels)].slice(0, 6) }]),
  );
  writeJson(SPEAKERS, {
    $comment: "Lingua Libre speakers and their accent, decided from English Wiktionary accent labels on their files (04-speakers.mjs). null = unknown, never used.",
    speakers: summary,
  });
  const counts = { us: 0, uk: 0, other: 0, unknown: 0 };
  for (const v of Object.values(summary)) counts[v.accent ?? "unknown"]++;
  return counts;
}
