/**
 * Step 06 (download): fetches the chosen human recordings from
 * upload.wikimedia.org into content-raw/audio/recordings/, level by level.
 *
 * Wikimedia limits how fast a client may download original files, and asks
 * automated clients to identify themselves with contact details. This pipeline
 * sends no personal contact details (DECISIONS AU6), so it stays far under the
 * limit instead: one file at a time, GAP_MS apart, and when the server answers
 * 429 it waits the full `retry-after` before trying again. It never changes its
 * identity to get around a limit.
 *
 * Only the first usable candidate of each word is downloaded here; 07-render
 * fetches a second candidate only when the first fails its checks.
 * Resumable: a file on disk is never fetched again, and a stopped run simply
 * continues with the next missing file.
 */
import { createHash } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { readJson } from "../content/lib/checkpoint.mjs";
import { USER_AGENT } from "./lib/commons.mjs";
import { RECORDINGS } from "./lib/paths.mjs";
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

export async function run({ levels, max = Infinity } = {}) {
  const targets = readJson(TARGETS);
  const selection = readJson(SELECTION);
  const summary = {};
  let fetched = 0;
  for (const level of levels) {
    const want = targets.filter((t) => t.level === level).flatMap((t) => (selection[t.id]?.usable[0] ? [selection[t.id].usable[0]] : []));
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
