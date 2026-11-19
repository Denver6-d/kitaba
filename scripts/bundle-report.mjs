/**
 * Bundle report and size budget (run after `next build`: `npm run check:bundle`).
 *
 * For every prerendered page in .next/server/app, it collects the scripts and
 * styles the HTML loads on first visit and sums their size, raw and gzipped.
 * It fails when:
 * - a page's first-load JavaScript (gzipped) is over BUDGET_KB;
 * - any first-load script contains the spell checker (nspell) or open-data
 *   library content: those must load on demand only (DECISIONS F1, OD13);
 * - a page other than /credits carries the licence notices.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

/** Project root; another checkout can be measured with `node scripts/bundle-report.mjs <root>`. */
const ROOT = process.argv[2] ?? join(fileURLToPath(new URL(".", import.meta.url)), "..");
const APP = join(ROOT, ".next", "server", "app");
const STATIC = join(ROOT, ".next");
/** Gzipped first-load JS per page. Measured in phase E (DECISIONS OD14); raise only with a recorded reason. */
export const BUDGET_KB = 440;

const MARKERS = [
  { name: "nspell (spell checker)", re: /compoundRuleCodes/ },
  { name: "library word chunk data", re: /"examples":\{"[to]\d+":\["/ },
  { name: "library sentence chunk data", re: /"rows":\[\[\d+,"/ },
];
const NOTICE_MARKER = /Permission to use, copy, modify, distribute and sell these word/;

function pages(dir) {
  const out = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) out.push(...pages(p));
    else if (f.endsWith(".html") && !f.startsWith("_")) out.push(p);
  }
  return out;
}

const route = (file) => {
  const r = `/${relative(APP, file).replace(/\\/g, "/").replace(/\.html$/, "")}`;
  return r === "/index" ? "/" : r;
};

const cache = new Map();
function asset(url) {
  if (!cache.has(url)) {
    const file = join(STATIC, url.replace(/^\/_next\//, "").split("?")[0]);
    const missing = !existsSync(file);
    const data = missing ? Buffer.alloc(0) : readFileSync(file);
    cache.set(url, { raw: data.length, gz: gzipSync(data, { level: 9 }).length, text: data.toString("utf8"), missing });
  }
  return cache.get(url);
}

export function report() {
  const rows = [];
  for (const file of pages(APP)) {
    const html = readFileSync(file, "utf8");
    const scripts = [...new Set([...html.matchAll(/\/_next\/static\/[^"'\s)]+?\.js/g)].map((m) => m[0]))];
    const styles = [...new Set([...html.matchAll(/\/_next\/static\/[^"'\s)]+?\.css/g)].map((m) => m[0]))];
    const js = scripts.map(asset);
    const css = styles.map(asset);
    const problems = [];
    for (const [i, a] of js.entries()) {
      // A script that cannot be found would count as 0 bytes and pass the budget unseen.
      if (a.missing) problems.push(`script not found in the build: ${scripts[i]}`);
      for (const m of MARKERS) if (m.re.test(a.text)) problems.push(`${m.name} in ${scripts[i]}`);
      if (route(file) !== "/credits" && NOTICE_MARKER.test(a.text)) problems.push(`licence notices in ${scripts[i]}`);
    }
    const jsGz = js.reduce((s, a) => s + a.gz, 0);
    if (jsGz / 1024 > BUDGET_KB) problems.push(`first-load JS ${(jsGz / 1024).toFixed(0)} KB > ${BUDGET_KB} KB`);
    rows.push({ route: route(file), scripts: scripts.length, jsRaw: js.reduce((s, a) => s + a.raw, 0), jsGz, cssGz: css.reduce((s, a) => s + a.gz, 0), problems });
  }
  return rows.sort((a, b) => a.route.localeCompare(b.route));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (!existsSync(APP)) {
    console.error("No build found: run `npm run build` first.");
    process.exit(1);
  }
  const rows = report();
  const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
  console.log("route".padEnd(22), "scripts", "JS raw".padStart(10), "JS gzip".padStart(10), "CSS gzip".padStart(10));
  for (const r of rows) console.log(r.route.padEnd(22), String(r.scripts).padStart(7), kb(r.jsRaw).padStart(10), kb(r.jsGz).padStart(10), kb(r.cssGz).padStart(10));
  const bad = rows.flatMap((r) => r.problems.map((p) => `${r.route}: ${p}`));
  if (bad.length) {
    console.error(`\nBundle check failed:\n${bad.join("\n")}`);
    process.exit(1);
  }
  console.log(`\nOK: every page under ${BUDGET_KB} KB of gzipped first-load JS; no spell checker, library data or notices in the wrong place.`);
}
