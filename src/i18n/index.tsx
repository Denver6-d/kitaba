"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useSettings } from "@/lib/settings-store";
import type { Lang } from "@/lib/settings";
import { ar, type Dictionary } from "./ar";
import { en } from "./en";
import { createFormatters } from "@/lib/format";

export const dictionaries: Record<Lang, Dictionary> = { ar, en };

interface I18nValue {
  readonly lang: Lang;
  readonly dir: "rtl" | "ltr";
  readonly t: Dictionary;
  readonly setLang: (lang: Lang) => void;
  /** Locale-aware number formatting with Western digits (consistent with typed English numbers). */
  readonly num: (n: number, digits?: number) => string;
  readonly date: (ms: number) => string;
  /** Percentage with Western digits and the Latin sign. */
  readonly pct: (n: number, digits?: number) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [settings, update] = useSettings();
  const lang = settings.lang;

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.title = dictionaries[lang].meta.title;
  }, [lang]);

  const value = useMemo<I18nValue>(() => {
    return {
      lang,
      dir: lang === "ar" ? "rtl" : "ltr",
      t: dictionaries[lang],
      setLang: (l) => update({ lang: l }),
      ...createFormatters(lang),
    };
  }, [lang, update]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const v = useContext(I18nContext);
  if (!v) throw new Error("useI18n must be used inside I18nProvider");
  return v;
}

/** Pick the string for the current language from an inline { ar, en } pair (used by content files). */
export function useLocalized() {
  const { lang } = useI18n();
  return <T,>(pair: { ar: T; en: T }): T => pair[lang];
}
