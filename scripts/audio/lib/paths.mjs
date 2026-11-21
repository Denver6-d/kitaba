/** Fixed locations used by the audio pipeline (dev-only). */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
export const PIPELINE = join(ROOT, "scripts", "audio");
/** Portable tools (ffmpeg, piper, the voice model). Git-ignored; one folder per tool. */
export const TOOLS = join(ROOT, "tools");
/** Raw downloads, indexes and checkpoints. Git-ignored (content-raw/). */
export const RAW = join(ROOT, "content-raw", "audio");
/** Human recordings as downloaded from Wikimedia Commons, one file per page id. Data only. */
export const RECORDINGS = join(RAW, "recordings");
/** Per-word work files (wav) and the per-level render checkpoints. */
export const WORK = join(RAW, "work");
/** Committed, compact output served to the browser. */
export const OUT = join(ROOT, "public", "audio", "v1");
export const TOOLS_FILE = join(PIPELINE, "tools.json");
export const TOOLS_LOCK = join(PIPELINE, "tools.lock.json");
