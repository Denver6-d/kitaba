"use client";

import type { TextCheck } from "@/domain/writing/check";
import type { SpellRequest, SpellResponse } from "./spell.worker";

/**
 * Main-thread side of the spelling worker. The worker (and with it nspell and
 * the 550 KB dictionary) is created only when a writing page asks for it, so
 * none of it is in the main bundle.
 */

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (r: TextCheck | null) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(new URL("./spell.worker.ts", import.meta.url), { type: "module" });
  w.onmessage = (e: MessageEvent<SpellResponse>) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    if (e.data.ok) p.resolve(e.data.result);
    else p.reject(new Error(e.data.error));
  };
  w.onerror = () => {
    for (const p of pending.values()) p.reject(new Error("worker"));
    pending.clear();
    w.terminate();
    worker = null;
  };
  worker = w;
  return w;
}

function send(req: Omit<SpellRequest, "id"> & { type: SpellRequest["type"] }): Promise<TextCheck | null> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    try {
      getWorker().postMessage({ ...req, id });
    } catch (e) {
      pending.delete(id);
      reject(e instanceof Error ? e : new Error("worker"));
    }
  });
}

/** Starts loading the dictionary in the background (call when a writing page opens). */
export const preloadSpeller = (): Promise<unknown> => send({ type: "load" });

export async function checkSpelling(text: string, personal: readonly string[], accent: "us" | "uk"): Promise<TextCheck> {
  const r = await send({ type: "check", text, personal, accent } as SpellRequest);
  return r ?? { words: 0, issues: [] };
}
