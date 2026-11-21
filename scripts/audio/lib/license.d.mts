type Meta = Record<string, { value?: unknown } | undefined>;
export declare function checkLicense(meta: Meta): { ok: true; code: string; short: string; url: string } | { ok: false; reason: string };
export declare function plainText(html: string): string;
export declare function authorOf(meta: Meta): string;
export declare function transcriptionOf(wikitext: string): string | null;
export declare const PROCESSING: string;
export declare function changeNotice(license: string, generated?: boolean): string;
