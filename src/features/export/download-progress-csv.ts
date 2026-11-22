import { CATEGORY_INFO } from "@/data/rules";
import type { SpellingCategory } from "@/data/schema";
import { spellingWordById } from "@/data/words";
import { DEFAULT_LEVEL, type ProfileRecord } from "@/domain/model";
import type { Lang } from "@/lib/settings";
import { downloadCsv } from "@/lib/download";
import type { Dictionary } from "@/i18n/ar";
import type { Repositories } from "@/repositories/types";
import { getLibrary, LIBRARY_WAIT_MS, withTimeout } from "@/features/library/library";
import { buildCsv, csvFilename, referencedWordIds, type CsvLabels, type CsvTableName, type WordInfo } from "./progress-csv";

export function csvLabels(t: Dictionary, lang: Lang): CsvLabels {
  return {
    headers: t.settings.csv.headers,
    category: (c) => CATEGORY_INFO[c as SpellingCategory]?.label[lang] ?? c,
    gameMode: (m) => (m === "mixed" ? t.settings.csv.mixedMode : (t.modes[m]?.name ?? m)),
    writingMode: (m) => t.writing.modeNames[m] ?? m,
  };
}

/**
 * Builds one CSV table from the same data as the JSON export and downloads it.
 * Works offline: bank words are bundled; open-data library words are looked up
 * in the stored library, and fall back to the stored spelling or id.
 */
export async function downloadProgressCsv(repos: Repositories, name: CsvTableName, labels: CsvLabels): Promise<void> {
  const file = await repos.data.exportAll();
  const libraryIds = referencedWordIds(file).filter((id) => !spellingWordById.has(id) && !id.startsWith("x-"));
  const profile = file.tables.profile.find((p) => p.id === "me" && p.deletedAt === undefined) as ProfileRecord | undefined;
  const library =
    libraryIds.length === 0
      ? new Map<string, WordInfo>()
      : await withTimeout<ReadonlyMap<string, WordInfo>>(getLibrary().findWords(libraryIds, profile?.levels.words ?? DEFAULT_LEVEL), LIBRARY_WAIT_MS, new Map());
  const lookup = (id: string): WordInfo | undefined => spellingWordById.get(id) ?? library.get(id);
  downloadCsv(buildCsv(name, file, { lookup, labels }), csvFilename(name));
}
