/**
 * Step 09 (upgrade): the human layer (DECISIONS AU12). Run on its own, after
 * the generated layer, as a long, low-priority, resumable background job:
 *
 *   npm run audio:build -- --only=upgrade [--levels=A1,A2]
 *
 * Level by level (A1 first), for each word that still has a generated file
 * (or none) and a human candidate not yet refused: download that recording
 * (politely, 06-download), render it (07-render, offline), and replace the
 * generated file. The manifest, indexes and credits are republished every
 * PUBLISH_EVERY replacements and at the end of each level.
 *
 * Working-tree safety: rendering and publishing happen inside a "busy"
 * section marked by content-raw/audio/upgrade.busy. Before checks and a
 * commit, create content-raw/audio/upgrade.pause and wait until no busy file
 * exists; the job then only downloads (which touches content-raw only) until
 * the pause file is removed. Stopping the job at any point loses nothing.
 */
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readJson, writeJson } from "../content/lib/checkpoint.mjs";
import { RAW } from "./lib/paths.mjs";
import { isPendingHuman, remainingCandidates } from "./lib/plan.mjs";
import { toolPaths } from "./01-tools.mjs";
import { TARGETS } from "./02-targets.mjs";
import { SELECTION } from "./05-select.mjs";
import { downloadRecording, lowPriority, recordingPath } from "./06-download.mjs";
import { levelSummary, renderFile, renderLevel } from "./07-render.mjs";
import { run as publish } from "./08-publish.mjs";

export const PAUSE = join(RAW, "upgrade.pause");
export const BUSY = join(RAW, "upgrade.busy");
const PUBLISH_EVERY = 25;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Runs `fn` while no pause is requested, marked busy. Busy is set before the pause check, so the two never miss each other. */
async function busy(fn) {
  for (;;) {
    writeFileSync(BUSY, String(process.pid));
    if (!existsSync(PAUSE)) break;
    rmSync(BUSY, { force: true });
    while (existsSync(PAUSE)) await sleep(5000);
  }
  try {
    return await fn();
  } finally {
    rmSync(BUSY, { force: true });
  }
}

export async function run({ levels } = {}) {
  lowPriority();
  const tools = toolPaths();
  const targets = readJson(TARGETS);
  const selection = readJson(SELECTION);
  const summary = {};
  for (const level of levels) {
    let replaced = 0;
    let sincePublish = 0;
    const pending = () => {
      const state = readJson(renderFile(level), { level, words: {} });
      return targets.filter((t) => t.level === level && isPendingHuman(state.words[t.id], selection[t.id]?.usable ?? []));
    };
    let todo = pending();
    console.log(`  ${level}: ${todo.length} words waiting for a human recording`);
    while (todo.length) {
      for (const t of todo) {
        const state = readJson(renderFile(level), { level, words: {} });
        const entry = state.words[t.id];
        const next = remainingCandidates(selection[t.id].usable, entry?.tried ?? [])[0];
        if (!next) continue;
        const got = await downloadRecording(next.url, recordingPath(next.title, next.url));
        await busy(async () => {
          if (got === "missing") {
            // Re-read: only this job writes this level's state now, but keep the latest copy.
            const s = readJson(renderFile(level), { level, words: {} });
            const e = s.words[t.id];
            if (e) {
              s.words[t.id] = { ...e, tried: [...(e.tried ?? []), `${next.title}: file is gone`] };
              writeJson(renderFile(level), s);
            }
            return;
          }
          const { made } = await renderLevel(level, { offline: true, only: new Set([t.id]), tools, targets, selection });
          const after = readJson(renderFile(level)).words[t.id];
          if (made && after?.replaced === "tts") {
            replaced++;
            sincePublish++;
          }
          if (sincePublish >= PUBLISH_EVERY) {
            await publish();
            sincePublish = 0;
            console.log(`  ${level}: ${replaced} generated files replaced so far`);
          }
        });
      }
      // A refused or vanished recording leaves the word pending with its next candidate: go round again.
      // Each pass adds one refusal (or a success) per word, so this ends.
      todo = pending();
    }
    await busy(() => publish());
    summary[level] = { replaced, ...levelSummary(level, targets, readJson(renderFile(level), { words: {} })) };
    console.log(`  ${level}: human layer finished`, summary[level]);
  }
  return summary;
}
