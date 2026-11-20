"use client";

import { useId, useState } from "react";
import { LEVEL_AREAS, LEVELS, type CefrLevel, type LearnerLevels, type LevelArea } from "@/domain/model";
import { useI18n } from "@/i18n";
import { Segmented } from "@/components/segmented";

/**
 * The learner's three levels, each changeable at any time. The change is
 * stored in the profile right away, so the very next game uses it.
 */
export function LevelsCard({
  levels,
  onChange,
  areas = LEVEL_AREAS,
}: {
  levels: LearnerLevels;
  onChange: (area: LevelArea, level: CefrLevel) => Promise<void>;
  areas?: readonly LevelArea[];
}) {
  const { t } = useI18n();
  const headingId = useId();
  const [saved, setSaved] = useState<LevelArea | null>(null);
  return (
    <section aria-labelledby={headingId} className="panel space-y-5 p-5 sm:p-6">
      <div className="space-y-1">
        <h2 id={headingId} className="text-2xl font-light">
          {t.levels.title}
        </h2>
        <p className="text-sm text-fg-2">{t.levels.intro}</p>
      </div>
      <div className={`grid gap-6 ${areas.length > 1 ? "lg:grid-cols-3" : ""}`}>
        {areas.map((area) => (
          <div key={area} className="min-w-0 space-y-2">
            <Segmented
              legend={`${t.levels.areas[area]}: ${levels[area]}`}
              value={levels[area]}
              onChange={(l) => {
                void onChange(area, l).then(() => setSaved(area));
              }}
              options={LEVELS.map((l) => ({ value: l, label: l }))}
              activeTone="gold"
            />
            <p className="text-sm text-fg-2">{t.levels.areaHelp[area]}</p>
            <p className="text-sm text-fg-2">{t.levels.desc[levels[area]]}</p>
          </div>
        ))}
      </div>
      <p className="min-h-5 text-sm text-fg" aria-live="polite">
        {saved ? `${t.levels.areas[saved]}: ${t.levels.saved}` : ""}
      </p>
    </section>
  );
}
