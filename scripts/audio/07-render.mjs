/**
 * Step 07 (render): makes one MP3 per target word, level by level (A1 first),
 * into public/audio/v1/<LEVEL>/<id>.<hash>.mp3.
 *
 * Per word: the human recordings chosen by 05-select are tried in order (a
 * file is refused when its trimmed length is not a single word's); when none
 * passes, the word is synthesised with the offline voice (piper, one process
 * per batch). A word that fails both is recorded as "none": the app speaks it
 * with Web Speech.
 *
 * `--offline` (the generated layer, DECISIONS AU12): no network. Only human
 * recordings already on disk are tried, every other word gets the offline
 * voice now and stays "pending" until the upgrade step brings its recording.
 * A generated word whose recording has arrived since is upgraded here too.
 *
 * Resumable and checkpointed: content-raw/audio/work/render-<LEVEL>.json is
 * written after every word, and a finished word is never made again (unless
 * its output file went missing). A replaced file stays on disk until
 * 08-publish, so the published index never points at a missing file.
 * `--levels` and `--max` limit a run.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { readJson, writeJson } from "../content/lib/checkpoint.mjs";
import { SECONDS, synthesize, toMp3 } from "./lib/audio.mjs";
import { OUT, WORK } from "./lib/paths.mjs";
import { candidatesToTry, remainingCandidates, wordAction } from "./lib/plan.mjs";
import { toolPaths } from "./01-tools.mjs";
import { TARGETS } from "./02-targets.mjs";
import { SELECTION } from "./05-select.mjs";
import { downloadRecording, recordingPath } from "./06-download.mjs";

export const renderFile = (level) => join(WORK, `render-${level}.json`);
const TTS_BATCH = 50;
/** Piper's phoneme lengths tried, in order, for a word that came out too short at the normal rate. */
export const SHORT_WORD_LENGTH_SCALES = [1.6, 2.2];
/** A toMp3 refusal because the trimmed audio is under the minimum length. */
const tooShort = (r) => !r.ok && typeof r.seconds === "number" && r.seconds < SECONDS.min;
/** The same for a stored entry: its reason is rounded to 0.01 s, and being refused means it was out of range. */
const storedTooShort = (reason = "") => Number(/^trimmed length ([\d.]+) s$/.exec(reason)?.[1] ?? Infinity) <= SECONDS.min;

const sha = (buf) => createHash("sha256").update(buf).digest("hex");

/** Moves a finished MP3 to its content-addressed name and returns that name. */
function placeMp3(level, id, tmp) {
  const buf = readFileSync(tmp);
  const name = `${id}.${sha(buf).slice(0, 10)}.mp3`;
  const dir = join(OUT, level);
  mkdirSync(dir, { recursive: true });
  renameSync(tmp, join(dir, name));
  return { name, bytes: buf.length };
}

/**
 * Renders one level. `only` limits it to some word ids; `offline` never
 * touches the network. Returns how many words were made or changed.
 */
export async function renderLevel(level, { offline = false, only = null, max = Infinity, tools = toolPaths(), targets = readJson(TARGETS), selection = readJson(SELECTION) } = {}) {
  const tmpDir = join(WORK, "tmp");
  mkdirSync(tmpDir, { recursive: true });
  const file = renderFile(level);
  const state = readJson(file, { level, words: {} });
  const save = () => writeJson(file, state);
  const fileExists = (r) => Boolean(r?.file) && existsSync(join(OUT, level, r.file));
  const onDisk = (c) => existsSync(recordingPath(c.title, c.url));
  let made = 0;
  const tts = [];

  for (const t of targets) {
    if (t.level !== level || (only && !only.has(t.id))) continue;
    if (made >= max) break;
    const stored = state.words[t.id];
    // Made before the slower retry existed: a voice refused only for being too short is voiced again.
    const prev = stored?.src === "none" && storedTooShort(stored.reason) ? { ...stored, src: undefined } : stored;
    const tried = [...(prev?.tried ?? [])];
    const remaining = remainingCandidates(selection[t.id]?.usable ?? [], tried);
    const toTry = candidatesToTry(remaining, { offline, onDisk });
    const action = wordAction(prev, { fileExists: fileExists(prev), toTry });
    if (action === "skip") continue;

    let done = false;
    for (const c of toTry) {
      const src = recordingPath(c.title, c.url);
      if (!offline) {
        try {
          if ((await downloadRecording(c.url, src)) === "missing") {
            tried.push(`${c.title}: file is gone`);
            continue;
          }
        } catch (e) {
          // Not a verdict on the recording: stop, so a later run tries again instead of using the voice.
          throw new Error(`download of ${c.title} failed: ${e instanceof Error ? e.message : e}`);
        }
      }
      const tmp = join(tmpDir, `${t.id}.mp3`);
      const r = toMp3(tools.ffmpeg, src, tmp, join(tmpDir, `${t.id}.wav`));
      if (!r.ok) {
        tried.push(`${c.title}: ${r.reason}`);
        continue;
      }
      const out = placeMp3(level, t.id, tmp);
      state.words[t.id] = { word: t.word, src: c.kind, file: out.name, bytes: out.bytes, seconds: Math.round(r.seconds * 100) / 100, title: c.title.replace(/^File:/, ""), page: c.page, author: c.author, license: c.license, licenseUrl: c.licenseUrl, ...(tried.length ? { tried } : {}), ...(prev?.src === "tts" ? { replaced: "tts" } : {}) };
      save();
      made++;
      done = true;
      break;
    }
    if (done) continue;
    if (prev?.src === "tts" && fileExists(prev)) {
      // Nothing usable arrived: keep the generated file, remember what was refused.
      if (tried.length !== (prev.tried?.length ?? 0)) {
        state.words[t.id] = { ...prev, tried };
        save();
      }
      continue;
    }
    tts.push({ t, tried });
    made++;
  }

  /** Synthesises and converts a batch; returns each word's toMp3 result (the MP3 is left at tmp). */
  const voice = (batch, lengthScale) => {
    const jobs = batch.map((x) => ({ ...x, wav: join(tmpDir, `${x.t.id}.tts.wav`) }));
    synthesize(
      tools.piper,
      tools.voice,
      jobs.map((x) => ({ text: `${x.t.word}.`, file: x.wav })),
      { lengthScale },
    );
    return jobs.map(({ t, wav }) => {
      const r = existsSync(wav) ? toMp3(tools.ffmpeg, wav, join(tmpDir, `${t.id}.mp3`), join(tmpDir, `${t.id}.wav`)) : { ok: false, reason: "not synthesised" };
      rmSync(wav, { force: true });
      return r;
    });
  };

  // The offline voice, in batches (the model loads once per batch).
  for (let i = 0; i < tts.length; i += TTS_BATCH) {
    const batch = tts.slice(i, i + TTS_BATCH);
    const results = voice(batch, 1);
    // Short function words ("the", "off") can come out under the minimum length: say them more slowly.
    for (const scale of SHORT_WORD_LENGTH_SCALES) {
      const short = batch.flatMap((x, k) => (tooShort(results[k]) ? [k] : []));
      if (!short.length) break;
      const again = voice(short.map((k) => batch[k]), scale);
      short.forEach((k, j) => (results[k] = again[j]));
    }
    for (const [k, { t, tried }] of batch.entries()) {
      const tmp = join(tmpDir, `${t.id}.mp3`);
      const r = results[k];
      if (r.ok) {
        const out = placeMp3(level, t.id, tmp);
        state.words[t.id] = { word: t.word, src: "tts", file: out.name, bytes: out.bytes, seconds: Math.round(r.seconds * 100) / 100, ...(tried.length ? { tried } : {}) };
      } else {
        state.words[t.id] = { word: t.word, src: "none", reason: r.reason, ...(tried.length ? { tried } : {}) };
      }
    }
    save();
    console.log(`  ${level}: ${Math.min(i + TTS_BATCH, tts.length)} / ${tts.length} generated`);
  }
  return { made, state };
}

/** Counts for the report. */
export function levelSummary(level, targets, state) {
  const all = targets.filter((t) => t.level === level);
  const rows = all.map((t) => state.words[t.id]).filter(Boolean);
  const count = (k) => rows.filter((r) => r.src === k).length;
  return {
    words: all.length,
    finished: rows.length,
    human: count("en-us") + count("lingualibre"),
    enUs: count("en-us"),
    lingualibre: count("lingualibre"),
    generated: count("tts"),
    none: count("none"),
    bytes: rows.reduce((s, r) => s + (r.bytes ?? 0), 0),
  };
}

export async function run({ levels, max = Infinity, offline = false } = {}) {
  const tools = toolPaths();
  const targets = readJson(TARGETS);
  const selection = readJson(SELECTION);
  let left = max;
  const summary = {};
  for (const level of levels) {
    const { made, state } = await renderLevel(level, { offline, max: left, tools, targets, selection });
    left -= made;
    summary[level] = levelSummary(level, targets, state);
    if (left <= 0) break;
  }
  return summary;
}
