/// <reference lib="webworker" />
/**
 * Spelling checker worker (DECISIONS F3). Loads nspell and the en-US
 * dictionary from this site (public/dict) on first use and checks texts off
 * the main thread, so typing never stutters. Nothing leaves the device.
 */
import nspell from "nspell";
import { checkText, type Speller, type TextCheck } from "@/domain/writing/check";
import { bankWords, ukForms } from "./bank";

export type SpellRequest =
  | { readonly id: number; readonly type: "load" }
  | { readonly id: number; readonly type: "check"; readonly text: string; readonly personal: readonly string[]; readonly accent: "us" | "uk" };

export type SpellResponse = { readonly id: number; readonly ok: true; readonly result: TextCheck | null } | { readonly id: number; readonly ok: false; readonly error: string };

let speller: Promise<Speller> | null = null;

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`dictionary ${res.status}`);
  return res.text();
}

function load(): Promise<Speller> {
  speller ??= Promise.all([fetchText("/dict/en-US.aff"), fetchText("/dict/en-US.dic")]).then(([aff, dic]) => nspell(aff, dic));
  speller.catch(() => {
    speller = null;
  });
  return speller;
}

const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.onmessage = async (e: MessageEvent<SpellRequest>) => {
  const req = e.data;
  try {
    const s = await load();
    const result = req.type === "check" ? checkText(req.text, { speller: s, personal: new Set(req.personal), accent: req.accent, ukForms, bank: bankWords }) : null;
    scope.postMessage({ id: req.id, ok: true, result } satisfies SpellResponse);
  } catch (err) {
    scope.postMessage({ id: req.id, ok: false, error: err instanceof Error ? err.message : "error" } satisfies SpellResponse);
  }
};
