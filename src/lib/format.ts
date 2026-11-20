import type { Lang } from "./settings";

/**
 * Number, percent and date formatting for both UI languages. Digits are always
 * Western (0-9), including in the Arabic UI, through the `latn` numbering
 * system (DECISIONS R4). Pure: no React, no DOM.
 */
export interface Formatters {
  readonly num: (n: number, digits?: number) => string;
  readonly pct: (n: number, digits?: number) => string;
  readonly date: (ms: number) => string;
}

export const localeFor = (lang: Lang): string => (lang === "ar" ? "ar-u-nu-latn" : "en-GB-u-nu-latn");

export function createFormatters(lang: Lang): Formatters {
  const locale = localeFor(lang);
  const numberFormats = new Map<number, Intl.NumberFormat>();
  const numberFormat = (digits: number) => {
    let f = numberFormats.get(digits);
    if (!f) {
      f = new Intl.NumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
      numberFormats.set(digits, f);
    }
    return f;
  };
  const dateFormat = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" });
  return {
    num: (n, digits = 0) => numberFormat(digits).format(n),
    // The Latin percent sign in both languages, next to Western digits.
    pct: (n, digits = 0) => `${numberFormat(digits).format(n)}%`,
    date: (ms) => dateFormat.format(new Date(ms)),
  };
}
