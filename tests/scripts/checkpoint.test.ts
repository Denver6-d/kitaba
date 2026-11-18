import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runStep } from "../../scripts/content/lib/checkpoint.mjs";

/** The content pipeline is resumable: a step with unchanged inputs and present outputs is skipped. */

const dirs: string[] = [];
function tmp() {
  const d = mkdtempSync(join(tmpdir(), "kitaba-ckpt-"));
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("runStep checkpoints", () => {
  it("skips a finished step and reruns when an input, an option or an output changes", async () => {
    const dir = tmp();
    const input = join(dir, "in.txt");
    const output = join(dir, "out.txt");
    writeFileSync(input, "a");
    let runs = 0;
    const step = (options: unknown = {}) =>
      runStep(dir, "demo", { inputs: [input], outputs: [output], options }, () => {
        runs++;
        writeFileSync(output, "x");
        return runs;
      });

    expect((await step()).skipped).toBe(false);
    const again = await step();
    expect(again).toEqual({ skipped: true, result: 1 });

    writeFileSync(input, "b"); // input changed
    expect((await step()).skipped).toBe(false);

    expect((await step({ target: 2 })).skipped).toBe(false); // option changed

    rmSync(output); // output missing
    expect((await step({ target: 2 })).skipped).toBe(false);
    expect(runs).toBe(4);
  });

  it("does not write a checkpoint when the step throws, so it runs again", async () => {
    const dir = tmp();
    await expect(runStep(dir, "fail", {}, () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    let ran = false;
    await runStep(dir, "fail", {}, () => {
      ran = true;
    });
    expect(ran).toBe(true);
  });
});
