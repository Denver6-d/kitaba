import type { Usable } from "./select.mjs";

export interface RenderEntry {
  src: "en-us" | "lingualibre" | "tts" | "none";
  file?: string;
  tried?: string[];
}
export declare function remainingCandidates<T extends Pick<Usable, "title">>(usable: readonly T[], tried?: readonly string[]): T[];
export declare function isHuman(entry: RenderEntry | undefined): boolean;
export declare function candidatesToTry<T>(remaining: readonly T[], opts: { offline: boolean; onDisk: (c: T) => boolean }): T[];
export declare function wordAction(entry: RenderEntry | undefined, opts: { fileExists: boolean; toTry: readonly unknown[] }): "skip" | "try" | "voice";
export declare function isPendingHuman(entry: RenderEntry | undefined, usable: readonly Pick<Usable, "title">[]): boolean;
