import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";

/**
 * Licence metadata for every open-data source (DECISIONS, section "Open data").
 * Part of `npm run validate:content`: a source without a licence, a licence
 * link or its obligations fails the pipeline.
 */

const fileSchema = z
  .object({
    name: z.string().min(1),
    url: z.string().url(),
    extract: z.enum(["tar", "bz2"]).nullable(),
    exclude: z.array(z.string()).optional(),
  })
  .strict();

const sourceSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().min(1),
    author: z.string().min(1),
    homepage: z.string(),
    version: z.string().min(1),
    license: z.string().min(1),
    licenseUrl: z.string(),
    obligations: z.array(z.string().min(1)),
    use: z.string().min(1),
    files: z.array(fileSchema),
  })
  .strict();

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8")) as unknown;
const { sources } = z.object({ $comment: z.string(), sources: z.array(sourceSchema) }).parse(read("../../scripts/content/sources.json"));
const lock = z
  .object({ $comment: z.string(), files: z.record(z.string(), z.object({ url: z.string().url(), sha256: z.string().regex(/^[0-9a-f]{64}$/), bytes: z.number().int().positive() }).passthrough()) })
  .parse(read("../../scripts/content/sources.lock.json"));

describe("open-data sources", () => {
  it("lists every source once, with licence, link and obligations", () => {
    expect(new Set(sources.map((s) => s.id)).size).toBe(sources.length);
    for (const s of sources) {
      if (s.id === "kitaba") continue; // our own content
      expect(s.licenseUrl, s.id).toMatch(/^https?:\/\//);
      expect(s.homepage, s.id).toMatch(/^https?:\/\//);
      expect(s.obligations.length, s.id).toBeGreaterThan(0);
    }
  });

  it("pins the exact snapshot of every downloaded file", () => {
    for (const s of sources)
      for (const f of s.files) {
        const pin = lock.files[`${s.id}/${f.name}`];
        expect(pin, `${s.id}/${f.name}`).toBeDefined();
        expect(pin?.url).toBe(f.url);
      }
  });

  it("never uses a rejected or share-alike source", () => {
    const text = JSON.stringify(sources).toLowerCase();
    for (const banned of ["wordfreq", "wiktionary", "oxford", "cambridge", "merriam", "collins", "subtlex", "cc by-sa", "share-alike"]) {
      expect(text, banned).not.toContain(banned);
    }
  });

  it("credits Tatoeba under CC BY 2.0 FR with per-author attribution", () => {
    const t = sources.find((s) => s.id === "tatoeba");
    expect(t?.license).toContain("CC BY 2.0 FR");
    expect(t?.obligations.join(" ")).toMatch(/author/i);
  });
});
