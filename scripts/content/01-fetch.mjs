/**
 * Step 01: download every source file listed in sources.json into
 * content-raw/downloads/<source>/ and extract it into
 * content-raw/extracted/<source>/.
 *
 * Repeatable: the SHA-256 of every file is pinned in sources.lock.json. A file
 * that is already present with the pinned hash is not downloaded again. A
 * download whose hash differs from the pin is refused unless --update is
 * passed. Tatoeba publishes a new export every week and keeps no old ones, so
 * accepting a new snapshot is a deliberate choice, recorded in the lock.
 * Resumable: downloads go to a .part file and are renamed only when complete.
 */
import { createWriteStream, existsSync, mkdirSync, renameSync, rmSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { bunzipTo, extractTar } from "./lib/archive.mjs";
import { hashFile, readJson, runStep, writeJson } from "./lib/checkpoint.mjs";
import { DOWNLOADS, EXTRACTED, LOCK_FILE, SOURCES_FILE, WORK } from "./lib/paths.mjs";

const SCRIPT = fileURLToPath(import.meta.url);
/** Identify the pipeline honestly, without any personal contact details. */
const USER_AGENT = "kitaba-content-pipeline/1.0 (open-data build script)";

async function download(url, dest) {
  const part = `${dest}.part`;
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT }, redirect: "follow" });
  if (!res.ok || !res.body) throw new Error(`download failed (${res.status}) for ${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(part));
  rmSync(dest, { force: true });
  renameSync(part, dest);
  return { lastModified: res.headers.get("last-modified") };
}

export async function run({ update = false, force = false } = {}) {
  const { sources } = readJson(SOURCES_FILE);
  const lock = readJson(LOCK_FILE, { files: {} });
  let changed = false;

  for (const source of sources) {
    for (const file of source.files) {
      const key = `${source.id}/${file.name}`;
      const dir = join(DOWNLOADS, source.id);
      mkdirSync(dir, { recursive: true });
      const dest = join(dir, file.name);
      const pinned = lock.files[key];

      if (existsSync(dest) && !force) {
        const sha256 = await hashFile(dest);
        if (pinned && pinned.sha256 !== sha256 && !update) {
          throw new Error(`${key}: local file does not match the pinned hash. Delete it, or pass --update to accept it.`);
        }
        if (!pinned || pinned.sha256 !== sha256) {
          lock.files[key] = { url: file.url, sha256, bytes: statSync(dest).size, fetchedAt: new Date().toISOString(), lastModified: pinned?.lastModified ?? null };
          changed = true;
        }
        console.log(`  have ${key}`);
      } else {
        console.log(`  get  ${key}`);
        const { lastModified } = await download(file.url, dest);
        const sha256 = await hashFile(dest);
        if (pinned && pinned.sha256 !== sha256 && !update) {
          rmSync(dest);
          throw new Error(`${key}: upstream file changed (pinned ${pinned.sha256.slice(0, 12)}, got ${sha256.slice(0, 12)}). Pass --update to accept a new snapshot.`);
        }
        lock.files[key] = { url: file.url, sha256, bytes: statSync(dest).size, fetchedAt: new Date().toISOString(), lastModified };
        changed = true;
      }

      if (file.extract) {
        const base = basename(file.name).replace(/\.(tar\.gz|tgz|tar\.bz2|bz2)$/, "");
        const target = join(EXTRACTED, source.id, base);
        await runStep(WORK, `extract-${source.id}-${base}`, { script: SCRIPT, inputs: [dest], outputs: [target], options: { exclude: file.exclude ?? [] }, force }, async () => {
          mkdirSync(join(EXTRACTED, source.id), { recursive: true });
          if (file.extract === "tar") extractTar(dest, target, file.exclude ?? []);
          else if (file.extract === "bz2") await bunzipTo(dest, target);
          else throw new Error(`unknown extract kind ${file.extract}`);
          return { target };
        });
      }
    }
  }

  if (changed) writeJson(LOCK_FILE, { $comment: "Exact snapshots used for the committed content. Written by 01-fetch.mjs.", files: sortKeys(lock.files) });
  return { files: Object.keys(lock.files).length };
}

function sortKeys(o) {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
}
