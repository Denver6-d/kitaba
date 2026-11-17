/** Minimal types for nspell 2.1.5 (MIT), the Hunspell-compatible spell checker loaded lazily on the writing pages. */
declare module "nspell" {
  interface NSpell {
    correct(word: string): boolean;
    suggest(word: string): string[];
    add(word: string): NSpell;
    remove(word: string): NSpell;
  }
  function nspell(aff: string | Uint8Array, dic?: string | Uint8Array): NSpell;
  function nspell(dictionary: { aff: string | Uint8Array; dic?: string | Uint8Array }): NSpell;
  export default nspell;
}
