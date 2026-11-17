/**
 * Copies the en-US Hunspell dictionary (dictionary-en@4.0.0, MIT AND BSD,
 * derived from SCOWL) into public/dict, where the writing pages fetch it
 * lazily. dictionary-en reads its files with node:fs, so it cannot be bundled
 * for the browser. Runs before `next dev` and `next build` (package.json).
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules", "dictionary-en");
const to = join(root, "public", "dict");
mkdirSync(to, { recursive: true });
copyFileSync(join(from, "index.aff"), join(to, "en-US.aff"));
copyFileSync(join(from, "index.dic"), join(to, "en-US.dic"));
copyFileSync(join(from, "license"), join(to, "LICENSE-dictionary-en.txt"));
console.log("dictionary copied to public/dict");
