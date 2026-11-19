/**
 * Node module hooks so pipeline steps can import the app's own pure TypeScript
 * (for example the writing checker in src/domain/writing) through Node's type
 * stripping: "@/x" resolves to src/x.ts, and extensionless relative imports
 * get ".ts". Used only by dev-time scripts; the app never loads this.
 */
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import { ROOT } from "./paths.mjs";

const SRC = join(ROOT, "src");

function withTs(path) {
  for (const p of [`${path}.ts`, `${path}.tsx`, join(path, "index.ts")]) if (existsSync(p)) return p;
  return null;
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const file = withTs(join(SRC, specifier.slice(2)));
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.endsWith(".ts") && !/\.[a-z]+$/.test(specifier)) {
    const file = withTs(fileURLToPath(new URL(specifier, context.parentURL)));
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
  }
  return next(specifier, context);
}
