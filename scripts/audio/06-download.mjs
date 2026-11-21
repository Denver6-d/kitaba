/**
 * Step 06 (download): fetches the chosen human recordings from
 * upload.wikimedia.org into content-raw/audio/recordings/, level by level.
 *
 * Wikimedia limits how fast a client may download original files. The client
 * identifies itself per the User-Agent policy, with the owner's public contact
 * URL (lib/commons.mjs, DECISIONS AU12), and stays polite: one file at a time,
 * GAP_MS apart, and when the server answers 429 it waits the full
 * `retry-after` before trying again. It never changes its identity to get
 * around a limit. The process runs at low CPU priority.
 *
 * Per word, the next candidate render has not refused yet is downloaded, and
 * words that already have a human file are skipped (DECISIONS AU12).
 * Resumable: a file on disk is never fetched again, and a stopped run simply
 * continues with the next missing file.
 */
import { createHash } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { constants, setPriority } from "node:os";
import { readJson } from "../content/lib/checkpoint.mjs";
import { USER_AGENT } from "./lib/commons.mjs";
import { RECORDINGS, WORK } from "./lib/paths.mjs";
import { isHuman, remainingCandidates } from "./lib/plan.mjs";
import { TARGETS } from "./02-targets.mjs";
import { SELECTION } from "./05-select.mjs";

/** Pause between two downloads. */
export const GAP_MS = 6000;
const TIMEOUT_MS = 30_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (s) => createHash("sha256").update(s).digest("hex");

/** Downloaded recordings are named by a hash of their title, never by anything taken from the page. */
export const recordingPath = (title, url) => join(RECORDINGS, `${sha(title).slice(0, 24)}${/\.[a-z0-9]+$/i.exec(url)?.[0]?.toLowerCase() ?? ""}`);

let last = 0;

/**
 * Downloads one recording, waiting out rate limits. Resolves "ok", or "missing"
 * when the file is gone (404/410). Throws on other repeated failures.
 */
export async function downloadRecording(url, dest, log = console.log) {
  if (existsSync(dest)) return "ok";
  mkdirSync(RECORDINGS, { recursive: true });
  for (let attempt = 1; ; attempt++) {
    const wait = last + GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
    let res;
    try {
      res = await fetch(url, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (e) {
      if (attempt >= 5) throw e;
      await sleep(10_000 * attempt);
      continue;
    }
    if (res.status === 429 || res.status === 503) {
      const after = Number(res.headers.get("retry-after"));
      const ms = (Number.isFinite(after) && after > 0 ? after : 600) * 1000;
      log(`  rate limited (${res.status}): waiting ${Math.round(ms / 1000)} s`);
      await res.body?.cancel();
      await sleep(ms);
      attempt = 0; // a rate limit is not a failure of this file
      continue;
    }
    if (res.status === 404 || res.status === 410) return "missing";
    if (!res.ok || !res.body) {
      await res.body?.cancel();
      if (attempt >= 5) throw new Error(`${res.status} for ${url}`);
      await sleep(10_000 * attempt);
      continue;
    }
    const part = `${dest}.part`;
    try {
      await pipeline(Readable.fromWeb(res.body), createWriteStream(part));
    } catch (e) {
      rmSync(part, { force: true });
      if (attempt >= 5) throw e;
      continue;
    }
    renameSync(part, dest);
    return "ok";
  }
}

/** Lowers this process's CPU priority (best effort): downloads are background work. */
export function lowPriority() {
  try {
    setPriority(constants.priority.PRIORITY_LOW);
  } catch {
    // not allowed on this system: run at normal priority
  }
}

/** The recording to fetch next for each word of a level that has no human file yet. */
export function wantedRecordings(level, targets, selection) {
  const state = readJson(join(WORK, `render-${level}.json`), { words: {} });
  return targets.flatMap((t) => {
    if (t.level !== level || isHuman(state.words[t.id])) return [];
    const next = remainingCandidates(selection[t.id]?.usable ?? [], state.words[t.id]?.tried ?? [])[0];
    return next ? [next] : [];
  });
}

export async function run({ levels, max = Infinity } = {}) {
  lowPriority();
  const targets = readJson(TARGETS);
  const selection = readJson(SELECTION);
  const summary = {};
  let fetched = 0;
  for (const level of levels) {
    const want = wantedRecordings(level, targets, selection);
    let have = want.filter((c) => existsSync(recordingPath(c.title, c.url))).length;
    let missing = 0;
    for (const c of want) {
      if (fetched >= max) break;
      const dest = recordingPath(c.title, c.url);
      if (existsSync(dest)) continue;
      const r = await downloadRecording(c.url, dest);
      fetched++;
      if (r === "ok") have++;
      else missing++;
      if (fetched % 25 === 0) console.log(`  ${level}: ${have} / ${want.length} recordings`);
    }
    summary[level] = { wanted: want.length, have, missing };
    if (fetched >= max) break;
  }
  return summary;
}
