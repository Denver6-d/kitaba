/** Fixed locations used by the content pipeline. Raw data never leaves content-raw/ (git-ignored). */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
export const PIPELINE = join(ROOT, "scripts", "content");
export const RAW = join(ROOT, "content-raw");
/** One folder per source; each holds only that source's downloads. */
export const DOWNLOADS = join(RAW, "downloads");
/** Extracted archives, one folder per source file. Data only: nothing in here is ever executed. */
export const EXTRACTED = join(RAW, "extracted");
/** Intermediate step outputs and checkpoints. */
export const WORK = join(RAW, "work");
/** Committed, compact output served to the browser. */
export const OUT = join(ROOT, "public", "content", "v1");
export const SOURCES_FILE = join(PIPELINE, "sources.json");
export const LOCK_FILE = join(PIPELINE, "sources.lock.json");
