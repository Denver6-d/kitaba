"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import type { Level, SpellingCategory } from "@/data/schema";
import { spellingCategorySchema } from "@/data/schema";
import { spellingWords } from "@/data/words";
import { shuffle, seededRng } from "@/domain/shared/random";
import { useI18n } from "@/i18n";
import { useRepoQuery } from "@/repositories/provider";
import { useClientSeed } from "@/lib/use-hydrated";
import { Page } from "@/components/page";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { SpellingSession } from "@/features/spelling/spelling-session";

const SESSION_SIZE = 10;
type LevelFilter = Level | "all";

export default function SpellingPage() {
  const { t, num } = useI18n();
  const seed = useClientSeed();
  const categoryId = useId();
  const [level, setLevel] = useState<LevelFilter>("all");
  const [category, setCategory] = useState<SpellingCategory | "all">("all");
  const [session, setSession] = useState<number | null>(null);
  const due = useRepoQuery((r) => r.words.dueCards(Date.now()));
  const cards = useRepoQuery((r) => r.words.allCards());

  // New words first (no card yet), shuffled once per session start.
  const words = useMemo(() => {
    if (session === null) return [];
    const known = new Set(cards.status === "ready" ? cards.data.map((c) => c.wordId) : []);
    const pool = spellingWords.filter(
      (w) => (level === "all" || w.level === level) && (category === "all" || w.category === category),
    );
    const rng = seededRng(seed + session);
    const fresh = shuffle(pool.filter((w) => !known.has(w.id)), rng);
    const practised = shuffle(pool.filter((w) => known.has(w.id)), rng);
    return [...fresh, ...practised].slice(0, SESSION_SIZE);
    // Words are chosen when a session starts; later card updates must not reshuffle it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const dueCount = due.status === "ready" ? due.data.length : 0;

  return (
    <Page title={t.spelling.title} intro={t.spelling.intro} width="narrow">
      {session !== null ? (
        <SpellingSession key={session} words={words} onDone={() => setSession(null)} />
      ) : (
        <div className="space-y-10">
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-rule p-5">
            <div>
              <h2 className="flex items-center gap-2 font-semibold">
                {t.spelling.review}
                {dueCount > 0 && (
                  <span className="grid min-w-6 place-items-center rounded-full bg-brass-fill px-1.5 text-xs font-bold text-[#14302e] tabular" aria-hidden="true">
                    {num(dueCount)}
                  </span>
                )}
              </h2>
              <p className="text-sm text-ink-soft">{t.spelling.dueCount(dueCount)}</p>
            </div>
            <Button asChild variant={dueCount > 0 ? "default" : "outline"} className="h-10">
              <Link href="/spelling/review">{t.spelling.review}</Link>
            </Button>
          </section>

          <section className="space-y-5">
            <h2 className="text-xl font-semibold">{t.spelling.newWords}</h2>
            <Segmented
              legend={t.spelling.level}
              value={level}
              onChange={setLevel}
              options={[
                { value: "all", label: t.spelling.all },
                { value: "A1", label: "A1" },
                { value: "A2", label: "A2" },
                { value: "B1", label: "B1" },
              ]}
            />
            <div className="space-y-1.5">
              <label htmlFor={categoryId} className="block text-xs text-ink-soft">
                {t.spelling.category}
              </label>
              <select
                id={categoryId}
                value={category}
                onChange={(e) => setCategory(e.target.value as SpellingCategory | "all")}
                className="h-10 w-full max-w-xs rounded-md border border-input bg-sheet px-3"
              >
                <option value="all">{t.spelling.all}</option>
                {spellingCategorySchema.options.map((c) => (
                  <option key={c} value={c}>
                    {t.spelling.categories[c]} ({num(spellingWords.filter((w) => w.category === c).length)})
                  </option>
                ))}
              </select>
            </div>
            <Button size="lg" className="h-11 px-6" disabled={cards.status === "loading"} onClick={() => setSession((s) => (s ?? 0) + 1)}>
              {t.common.start}
            </Button>
          </section>
        </div>
      )}
    </Page>
  );
}
