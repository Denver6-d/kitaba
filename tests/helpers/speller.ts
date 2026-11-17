import { readFileSync } from "node:fs";
import nspell from "nspell";
import type { Speller } from "@/domain/writing/check";

let cached: Speller | null = null;

/** The same en-US Hunspell dictionary the browser loads (read from node_modules). */
export function realSpeller(): Speller {
  if (!cached) {
    const aff = readFileSync("node_modules/dictionary-en/index.aff", "utf8");
    const dic = readFileSync("node_modules/dictionary-en/index.dic", "utf8");
    cached = nspell(aff, dic);
  }
  return cached;
}
