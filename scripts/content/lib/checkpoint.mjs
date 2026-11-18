/**
 * Checkpoints make the pipeline resumable and repeatable. A step is identified
 * by its name and a key: the hash of its script, its options and its input
 * files. When the stored key matches and every declared output still exists,
 * the step is skipped. Writes are atomic (temp file + rename), so an
 * interrupted run never leaves a half-written checkpoint or output behind.
 */
import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export function writeAtomic(file, data) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, data);
  renameSync(tmp, file);
}

export function writeJson(file, value) {
  writeAtomic(file, `${JSON.stringify(value, null, 2)}\n`);
}

export function readJson(file, fallback = undefined) {
  if (!existsSync(file)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`missing file: ${file}`);
  }
  return JSON.parse(readFileSync(file, "utf8"));
}

export function hashFile(file) {
  return new Promise((resolve, reject) => {
    const h = createHash("sha256");
    createReadStream(file)
      .on("data", (c) => h.update(c))
      .on("error", reject)
      .on("end", () => resolve(h.digest("hex")));
  });
}

export function hashString(s) {
  return createHash("sha256").update(s).digest("hex");
}

/** The key that decides whether a step must run again. */
export async function stepKey({ script, inputs = [], options = {} }) {
  const parts = [script ? await hashFile(script) : "", JSON.stringify(options)];
  for (const f of [...inputs].sort()) parts.push(`${f}:${existsSync(f) ? await hashFile(f) : "missing"}`);
  return hashString(parts.join("\n"));
}

/**
 * Runs `fn` unless a checkpoint with the same key exists and all outputs are present.
 * @returns {Promise<{ skipped: boolean, result: unknown }>}
 */
export async function runStep(workDir, name, { script, inputs = [], outputs = [], options = {}, force = false }, fn) {
  const file = join(workDir, `${name}.checkpoint.json`);
  const key = await stepKey({ script, inputs, options });
  const prev = readJson(file, null);
  if (!force && prev && prev.key === key && outputs.every((o) => existsSync(o))) {
    return { skipped: true, result: prev.result };
  }
  const result = await fn();
  writeJson(file, { name, key, at: new Date().toISOString(), outputs, result: result ?? null });
  return { skipped: false, result };
}
