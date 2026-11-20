"use client";

import { useCallback, useSyncExternalStore } from "react";
import { applySettingsToDocument, DEFAULT_SETTINGS, parseSettings, SETTINGS_KEY, type Settings } from "./settings";

/** Tiny external store over localStorage so every component sees the same settings. */
let cache: Settings | null = null;
const listeners = new Set<() => void>();

function read(): Settings {
  if (cache) return cache;
  try {
    cache = parseSettings(window.localStorage.getItem(SETTINGS_KEY));
  } catch {
    cache = DEFAULT_SETTINGS;
  }
  return cache;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === SETTINGS_KEY) {
      cache = parseSettings(e.newValue);
      applySettingsToDocument(cache);
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function updateSettings(patch: Partial<Settings>): void {
  const next = { ...read(), ...patch };
  cache = next;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {
    // Storage may be unavailable (private mode); settings still apply for this session.
  }
  applySettingsToDocument(next);
  for (const l of listeners) l();
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const settings = useSyncExternalStore(subscribe, read, () => DEFAULT_SETTINGS);
  const update = useCallback((patch: Partial<Settings>) => updateSettings(patch), []);
  return [settings, update];
}

