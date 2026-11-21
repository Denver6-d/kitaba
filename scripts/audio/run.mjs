/**
 * Audio pipeline runner (dev-only). Usage:
 *   npm run audio:build                          every step, every level not yet finished
 *   npm run audio:build -- --only=tools          one step
 *   npm run audio:build -- --from=select         start at a step
 *   npm run audio:build -- --levels=A1,A2        limit render and publish to these levels
 *   npm run audio:build -- --max=200             render at most this many words in this run
 *   npm run audio:build -- --force               ignore checkpoints of the index steps
 *
 * Per word, the source is: a human recording from Wikimedia Commons with an
 * allowed licence, else the offline neural voice, else nothing (the app then
 * uses the device's Web Speech voice). See DECISIONS "Pronunciation audio".
 * Every step is checkpointed under content-raw/audio, so a run can stop at any
 * point and the next session continues where it stopped.
 */
const STEPS = [
  { name: "tools", load: () => import("./01-tools.mjs") },
  { name: "targets", load: () => import("./02-targets.mjs") },
  { name: "index", load: () => import("./03-index.mjs") },
  { name: "speakers", load: () => import("./04-speakers.mjs") },
  { name: "select", load: () => import("./05-select.mjs") },
  { name: "download", load: () => import("./06-download.mjs") },
  { name: "render", load: () => import("./07-render.mjs") },
  { name: "publish", load: () => import("./08-publish.mjs") },
];

const LEVELS = ["A1", "A2", "B1", "B2", "C1"];

function parseArgs(argv) {
  const args = { from: null, only: null, force: false, levels: LEVELS, max: Infinity };
  for (const a of argv) {
    if (a.startsWith("--from=")) args.from = a.slice(7);
    else if (a.startsWith("--only=")) args.only = a.slice(7);
    else if (a === "--force") args.force = true;
    else if (a.startsWith("--levels=")) args.levels = a.slice(9).split(",");
    else if (a.startsWith("--max=")) args.max = Number(a.slice(6));
    else throw new Error(`unknown argument ${a}`);
  }
  for (const l of args.levels) if (!LEVELS.includes(l)) throw new Error(`unknown level ${l}`);
  if (!(args.max > 0)) throw new Error("--max must be a positive number");
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
