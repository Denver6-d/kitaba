import { describe, expect, it } from "vitest";
import { CATEGORY_INFO, trickFor, TRICK_EXAMPLE_PREFIX } from "@/data/rules";

/** Rule and trick content (DECISIONS R15, M3). */

const plain = (s: string) => s.toLowerCase().replace(/-/g, "");

describe("memory tricks", () => {
  it("name their example words in both languages", () => {
    for (const [cat, info] of Object.entries(CATEGORY_INFO)) {
      for (const w of info.trickWords) {
        expect(plain(info.trick.en), `${cat} en: ${w}`).toContain(w);
        expect(plain(info.trick.ar), `${cat} ar: ${w}`).toContain(w);
      }
    }
  });

  it("are shown as an example when the missed word is not the trick's word", () => {
    const ieEi = CATEGORY_INFO["ie-ei"];
    expect(trickFor(ieEi, "friend", "ar")).toBe(ieEi.trick.ar);
    expect(trickFor(ieEi, "Friend ", "en")).toBe(ieEi.trick.en);
    expect(trickFor(ieEi, "receive", "ar")).toBe(`مثال: ${ieEi.trick.ar}`);
    expect(trickFor(ieEi, "receive", "en")).toBe(`Example: ${ieEi.trick.en}`);
    // Either spelling of a British/American trick word is its own word.
    const ba = CATEGORY_INFO["british-american"];
    expect(trickFor(ba, "colour", "en")).toBe(ba.trick.en);
    expect(trickFor(ba, "centre", "en").startsWith(TRICK_EXAMPLE_PREFIX.en)).toBe(true);
    // A trick that names no word to spell is never prefixed.
    const pb = CATEGORY_INFO["p-b"];
    expect(pb.trickWords).toEqual([]);
    expect(trickFor(pb, "pebble", "ar")).toBe(pb.trick.ar);
  });

  it("uses the owner's ie/ei wording", () => {
    expect(CATEGORY_INFO["ie-ei"].trick.ar).toBe("كلمة friend تنتهي بـ end: الصديق يبقى معك حتى النهاية.");
  });
});

describe("verb-endings rule", () => {
  const { rule } = CATEGORY_INFO["verb-endings"];
  it("says y becomes ied only before -ed and stays before -ing", () => {
    for (const text of [rule.en, rule.ar]) {
      expect(text).toContain("study → studied");
      expect(text).toContain("studying");
      expect(text).not.toMatch(/studiing/);
    }
    expect(rule.en).toMatch(/only before -ed/);
    expect(rule.en).toMatch(/y stays before -ing/);
  });
  it("limits doubling to one-syllable consonant-vowel-consonant words, with read → reading as the counter-example", () => {
    for (const text of [rule.en, rule.ar]) {
      expect(text).toContain("stop → stopping");
      expect(text).toContain("read → reading");
    }
    expect(rule.en).toMatch(/one-syllable word that ends consonant-vowel-consonant/);
    // Longer words with a stressed last syllable double too (occurred and preferred are bank words).
    for (const text of [rule.en, rule.ar]) expect(text).toContain("occur → occurred");
  });
});
