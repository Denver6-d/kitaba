/**
 * Decompression through the system's archive tools (dev-only, no new npm
 * dependency): `tar` (bsdtar on Windows and macOS, GNU tar on Linux) and
 * `bzip2`. Arguments are passed as an array, never through a shell.
 * Archives are treated as data: extracted into their own empty folder and
 * never executed.
 */
import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, mkdirSync, renameSync, rmSync } from "node:fs";
import { createGunzip } from "node:zlib";
import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { relative } from "node:path";

/** @param {string[]} exclude glob patterns to skip (for example dangling symlinks). */
export function extractTar(archive, destDir, exclude = []) {
  rmSync(destDir, { recursive: true, force: true });
  mkdirSync(destDir, { recursive: true });
  // Run inside destDir with a relative archive path: GNU tar reads "C:\..." as a remote host.
  // --no-same-owner: never restore ownership; entries stay inside destDir (tar refuses ../ paths by default).
  const r = spawnSync("tar", ["-xf", relative(destDir, archive).replaceAll("\\", "/"), "--no-same-owner", ...exclude.map((p) => `--exclude=${p}`)], { cwd: destDir, stdio: "inherit" });
  if (r.status !== 0) throw new Error(`tar failed on ${archive} (is tar installed?)`);
}

export async function gunzipTo(file, out) {
  const tmp = `${out}.part`;
  await pipeline(createReadStream(file), createGunzip(), createWriteStream(tmp));
  renameSync(tmp, out);
}

export async function bunzipTo(file, out) {
  const tmp = `${out}.part`;
  const child = spawn("bzip2", ["-dc", file], { stdio: ["ignore", "pipe", "inherit"] });
  const exited = new Promise((resolve, reject) => {
    child.on("error", (e) => reject(new Error(`bzip2 not available: ${e.message}`)));
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`bzip2 failed on ${file}`))));
  });
  await Promise.all([pipeline(child.stdout, createWriteStream(tmp)), exited]);
  renameSync(tmp, out);
}
