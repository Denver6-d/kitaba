/**
 * Step 01 (tools): downloads the portable tools listed in tools.json into
 * tools/<id>/ (git-ignored). Nothing is installed globally, no admin rights are
 * needed, and nothing outside the project folder is touched.
 *
 * - ffmpeg's SHA-256 is pinned in tools.json (published by gyan.dev).
 * - The voice files are checked against the MD5 that piper-voices publishes in
 *   voices.json, and pinned by SHA-256 in tools.lock.json on first download.
 * - Piper publishes no checksum: its SHA-256 is pinned in tools.lock.json on
 *   first download, and a different file is refused afterwards.
 *
 * Archives are extracted into their own empty folder with the system's bsdtar
 * (arguments as an array, no shell). Only the two executables named in
 * tools.json are ever run.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync, mkdirSync, renameSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { readJson, writeJson } from "../content/lib/checkpoint.mjs";
import { TOOLS, TOOLS_FILE, TOOLS_LOCK } from "./lib/paths.mjs";

const USER_AGENT = "kitaba-audio-pipeline/1.0 (open-data build script)";

function hash(file, algo) {
  return new Promise((resolve, reject) => {
    const h = createHash(algo);
    createReadStream(file)
      .on("data", (c) => h.update(c))
      .on("error", reject)
      .on("end", () => resolve(h.digest("hex")));
  });
}

async function download(url, dest) {
  const part = `${dest}.part`;
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT }, redirect: "follow" });
  if (!res.ok || !res.body) throw new Error(`download failed (${res.status}) for ${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(part));
  rmSync(dest, { force: true });
  renameSync(part, dest);
}

/** bsdtar ships with Windows 10+ and reads zip files; GNU tar (Git Bash) does not. */
function unzip(archive, destDir) {
  rmSync(destDir, { recursive: true, force: true });
  mkdirSync(destDir, { recursive: true });
  const tar = process.platform === "win32" ? join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe") : "tar";
  const r = spawnSync(tar, ["-xf", archive, "-C", destDir], { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`could not extract ${archive}`);
}

/** Paths of the tools, for the other steps. Throws when a tool is missing. */
export function toolPaths() {
  const { tools } = readJson(TOOLS_FILE);
  const byId = Object.fromEntries(tools.map((t) => [t.id, t]));
  const paths = {
    ffmpeg: join(TOOLS, "ffmpeg", "x", byId.ffmpeg.exe),
    piper: join(TOOLS, "piper", "x", byId.piper.exe),
    voice: join(TOOLS, "voice", "en_US-ljspeech-high.onnx"),
  };
  for (const [k, p] of Object.entries(paths)) if (!existsSync(p)) throw new Error(`${k} missing at ${p}: run "npm run audio:build -- --only=tools"`);
  return paths;
}

async function fetchVerified({ key, url, dest, sha256, md5, lock }) {
  const pinned = sha256 ?? lock.files[key]?.sha256;
  if (existsSync(dest)) {
    const have = await hash(dest, "sha256");
    if (!pinned || have === pinned) {
      if (!pinned) lock.files[key] = { url, sha256: have, bytes: statSync(dest).size, pinnedAt: new Date().toISOString() };
      return false;
    }
    rmSync(dest);
  }
  console.log(`  get  ${key}`);
  await download(url, dest);
  if (md5 && (await hash(dest, "md5")) !== md5) throw new Error(`${key}: MD5 differs from the published one`);
  const got = await hash(dest, "sha256");
  if (pinned && got !== pinned) throw new Error(`${key}: SHA-256 ${got} differs from the pinned ${pinned}`);
  if (!pinned) lock.files[key] = { url, sha256: got, bytes: statSync(dest).size, pinnedAt: new Date().toISOString() };
  return true;
}

export async function run() {
  if (process.platform !== "win32") throw new Error("the pinned portable tools are Windows builds; see scripts/audio/tools.json");
  const { tools } = readJson(TOOLS_FILE);
  const lock = readJson(TOOLS_LOCK, { files: {} });
  for (const tool of tools) {
    const dir = join(TOOLS, tool.id);
    mkdirSync(dir, { recursive: true });
    if (tool.files) {
      for (const f of tool.files) await fetchVerified({ key: `${tool.id}/${f.name}`, url: f.url, dest: join(dir, f.name), md5: f.md5, lock });
      continue;
    }
    const name = tool.url.split("/").pop();
    const archive = join(dir, name);
    const fresh = await fetchVerified({ key: `${tool.id}/${name}`, url: tool.url, dest: archive, sha256: tool.sha256, lock });
    if (fresh || !existsSync(join(dir, "x", tool.exe))) unzip(archive, join(dir, "x"));
    if (!existsSync(join(dir, "x", tool.exe))) throw new Error(`${tool.id}: ${tool.exe} not found after extraction`);
  }
  writeJson(TOOLS_LOCK, lock);
  return toolPaths();
}
