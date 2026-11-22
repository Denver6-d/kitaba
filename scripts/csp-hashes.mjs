/**
 * After `next build` (npm "postbuild"): writes a <meta> Content-Security-Policy
 * into every prerendered page in .next/server, allowing exactly the inline
 * scripts that page contains, by SHA-256 hash (DECISIONS SEC1, src/config/csp.ts).
 *
 * The browser enforces this policy together with the header policy from
 * next.config.ts, so on these pages an injected inline script cannot run.
 * A page that was not prerendered has no <meta> policy and falls back to the
 * header policy alone. Running the script twice replaces the earlier tag.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
const META_RE = /<meta http-equiv="Content-Security-Policy" content="[^"]*"\/>/g;

/** Contents of the inline (no src) scripts, in document order. */
export function inlineScripts(html) {
  return [...html.matchAll(SCRIPT_RE)].filter((m) => !/\bsrc\s*=/i.test(m[1])).map((m) => m[2]);
}

export function scriptHash(content) {
  return `'sha256-${createHash("sha256").update(content, "utf8").digest("base64")}'`;
}

/** Mirrors metaScriptPolicy() in src/config/csp.ts (a test checks they agree). */
export function metaPolicy(hashes) {
  return ["script-src", "'self'", ...hashes].join(" ");
}

/**
 * The page with its <meta> policy, placed before the first script: right after
 * <meta charSet> when that comes first, otherwise right after <head>.
 * Returns null when the page has no <head>.
 */
export function withCspMeta(html) {
  const clean = html.replace(META_RE, "");
  const hashes = [...new Set(inlineScripts(clean).map(scriptHash))];
  const tag = `<meta http-equiv="Content-Security-Policy" content="${metaPolicy(hashes)}"/>`;
  const firstScript = clean.search(/<script\b/i);
  const charset = /<meta charSet="utf-8"\/>/i.exec(clean);
  if (charset && (firstScript === -1 || charset.index < firstScript)) {
    const at = charset.index + charset[0].length;
    return clean.slice(0, at) + tag + clean.slice(at);
  }
  const head = /<head[^>]*>/i.exec(clean);
  if (!head || (firstScript !== -1 && head.index > firstScript)) return null;
  const at = head.index + head[0].length;
  return clean.slice(0, at) + tag + clean.slice(at);
}

function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? htmlFiles(p) : e.name.endsWith(".html") ? [p] : [];
  });
}

export function run(serverDir) {
  if (!existsSync(serverDir)) throw new Error(`csp-hashes: ${serverDir} not found; run next build first`);
  let done = 0;
  for (const file of htmlFiles(serverDir)) {
    const out = withCspMeta(readFileSync(file, "utf8"));
    if (out === null) throw new Error(`csp-hashes: no <head> before the first script in ${file}`);
    writeFileSync(file, out);
    done += 1;
  }
  return done;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const n = run(join(root, ".next", "server"));
  console.log(`csp-hashes: script hashes written into ${n} prerendered pages`);
}
