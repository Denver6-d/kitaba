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
 * Resumable and checkpointed: content-raw/audio/work/render-<LEVEL>.json is
 * written after every word, and a finished word is never made again (unless
 * its output file went missing). `--levels` and `--max` limit a run.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { readJson, writeJson } from "../content/lib/checkpoint.mjs";
import { synthesize, toMp3 } from "./lib/audio.mjs";
import { OUT, WORK } from "./lib/paths.mjs";
import { toolPaths } from "./01-tools.mjs";
import { TARGETS } from "./02-targets.mjs";
import { SELECTION } from "./05-select.mjs";
import { downloadRecording, recordingPath } from "./06-download.mjs";

export const renderFile = (level) => join(WORK, `render-${level}.json`);
const TTS_BATCH = 50;

const sha = (buf) => createHash("sha256").update(buf).digest("hex");

/** Moves a finished MP3 to its content-addressed name and returns that name. */
function publishMp3(level, id, tmp, previous) {
  const buf = readFileSync(tmp);
  const name = `${id}.${sha(buf).slice(0, 10)}.mp3`;
  const dir = join(OUT, level);
  mkdirSync(dir, { recursive: true });
  renameSync(tmp, join(dir, name));
  if (previous && previous !== name) rmSync(join(dir, previous), { force: true });
  return { name, bytes: buf.length };
}

export async function run({ levels, max = Infinity } = {}) {
  const tools = toolPaths();
  const targets = readJson(TARGETS);
  const selection = readJson(SELECTION);
  const tmpDir = join(WORK, "tmp");
  mkdirSync(tmpDir, { recursive: true });
  let made = 0;
  const summary = {};

  for (const level of levels) {
    const file = renderFile(level);
    const state = readJson(file, { level, words: {} });
    const save = () => writeJson(file, state);
    const isDone = (id) => {
      const r = state.words[id];
      return r && (r.src === "none" || existsSync(join(OUT, level, r.file)));
    };
    const todo = targets.filter((t) => t.level === level && !isDone(t.id));
    const tts = [];

    for (const t of todo) {
      if (made >= max) break;
      const sel = selection[t.id];
      const tried = [];
      let done = false;
      for (const c of sel?.usable ?? []) {
        const src = recordingPath(c.title, c.url);
        try {
          if ((await downloadRecording(c.url, src)) === "missing") {
            tried.push(`${c.title}: file is gone`);
            continue;
          }
        } catch (e) {
          // Not a verdict on the recording: stop, so a later run tries again instead of using the voice.
          throw new Error(`download of ${c.title} failed: ${e instanceof Error ? e.message : e}`);
        }
        const tmp = join(tmpDir, `${t.id}.mp3`);
        const r = toMp3(tools.ffmpeg, src, tmp, join(tmpDir, `${t.id}.wav`));
        if (!r.ok) {
          tried.push(`${c.title}: ${r.reason}`);
          continue;
        }
        const out = publishMp3(level, t.id, tmp, state.words[t.id]?.file);
        state.words[t.id] = { word: t.word, src: c.kind, file: out.name, bytes: out.bytes, seconds: Math.round(r.seconds * 100) / 100, title: c.title.replace(/^File:/, ""), page: c.page, author: c.author, license: c.license, licenseUrl: c.licenseUrl, ...(tried.length ? { tried } : {}) };
        save();
        if (++made % 25 === 0) console.log(`  ${level}: ${made} words this run`);
        done = true;
        break;
      }
      if (!done) {
        tts.push({ t, tried });
        made++;
      }
    }

    // The offline voice, in batches (the model loads once per batch).
    for (let i = 0; i < tts.length; i += TTS_BATCH) {
      const batch = tts.slice(i, i + TTS_BATCH).map((x) => ({ ...x, wav: join(tmpDir, `${x.t.id}.tts.wav`) }));
      synthesize(
        tools.piper,
        tools.voice,
        batch.map((x) => ({ text: `${x.t.word}.`, file: x.wav })),
      );
      for (const { t, tried, wav } of batch) {
        const tmp = join(tmpDir, `${t.id}.mp3`);
        const r = existsSync(wav) ? toMp3(tools.ffmpeg, wav, tmp, join(tmpDir, `${t.id}.wav`)) : { ok: false, reason: "not synthesised" };
        rmSync(wav, { force: true });
        if (r.ok) {
          const out = publishMp3(level, t.id, tmp, state.words[t.id]?.file);
          state.words[t.id] = { word: t.word, src: "tts", file: out.name, bytes: out.bytes, seconds: Math.round(r.seconds * 100) / 100, ...(tried.length ? { tried } : {}) };
        } else {
          state.words[t.id] = { word: t.word, src: "none", reason: r.reason, ...(tried.length ? { tried } : {}) };
        }
      }
      save();
    }

    const all = targets.filter((t) => t.level === level);
    const rows = all.map((t) => state.words[t.id]).filter(Boolean);
    const count = (k) => rows.filter((r) => r.src === k).length;
    summary[level] = {
      words: all.length,
      finished: rows.length,
      human: count("en-us") + count("lingualibre"),
      enUs: count("en-us"),
      lingualibre: count("lingualibre"),
      generated: count("tts"),
      none: count("none"),
      bytes: rows.reduce((s, r) => s + (r.bytes ?? 0), 0),
    };
    if (made >= max) break;
  }
  return summary;
}
