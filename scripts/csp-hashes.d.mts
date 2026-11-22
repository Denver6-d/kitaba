export function inlineScripts(html: string): string[];
export function scriptHash(content: string): string;
export function metaPolicy(hashes: readonly string[]): string;
export function withCspMeta(html: string): string | null;
export function run(serverDir: string): number;
