export function writeAtomic(file: string, data: string | Uint8Array): void;
export function writeJson(file: string, value: unknown): void;
export function readJson<T = unknown>(file: string, fallback?: T): T;
export function hashFile(file: string): Promise<string>;
export function hashString(s: string): string;
export function stepKey(o: { script?: string; inputs?: readonly string[]; options?: unknown }): Promise<string>;
export function runStep<T>(
  workDir: string,
  name: string,
  o: { script?: string; inputs?: readonly string[]; outputs?: readonly string[]; options?: unknown; force?: boolean },
  fn: () => Promise<T> | T,
): Promise<{ skipped: boolean; result: T }>;
