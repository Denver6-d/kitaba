/**
 * Content pipeline runner (dev-only). Usage:
 *   npm run content:build                 run every step, skipping finished ones
 *   npm run content:build -- --from=words start at a step
 *   npm run content:build -- --only=fetch run one step
 *   npm run content:build -- --force      ignore checkpoints
 *   npm run content:build -- --update     accept new upstream snapshots (01-fetch)
 *
 * Each step is checkpointed in content-raw/work, so the pipeline can stop and
 * resume across sessions. Only the compact output in public/content/v1 and the
 * reviewed source files under scripts/content are committed.
 */
const STEPS = [
  { name: "fetch", load: () => import("./01-fetch.mjs") },
  { name: "lexicon", load: () => import("./02-lexicon.mjs") },
  { name: "frequency", load: () => import("./03-frequency.mjs") },
  { name: "words", load: () => import("./04-words.mjs") },
  { name: "publish", load: () => import("./09-publish.mjs") },
];

function parseArgs(argv) {
  const args = { from: null, only: null, force: false, update: false };
  for (const a of argv) {
    if (a.startsWith("--from=")) args.from = a.slice(7);
    else if (a.startsWith("--only=")) args.only = a.slice(7);
    else if (a === "--force") args.force = true;
    else if (a === "--update") args.update = true;
    else throw new Error(`unknown argument ${a}`);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const names = STEPS.map((s) => s.name);
  for (const n of [args.from, args.only]) if (n && !names.includes(n)) throw new Error(`unknown step ${n}; steps: ${names.join(", ")}`);
  const start = args.from ? names.indexOf(args.from) : 0;
  for (const step of STEPS.slice(start)) {
    if (args.only && step.name !== args.only) continue;
    const t = Date.now();
    console.log(`> ${step.name}`);
    const mod = await step.load();
    const result = await mod.run(args);
    console.log(`  done in ${((Date.now() - t) / 1000).toFixed(1)} s`, result ?? "");
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
