"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { lessons } from "@/data/lessons";
import { useI18n } from "@/i18n";
import { useRepos } from "@/repositories/provider";
import { Page } from "@/components/page";
import { KeyboardSvg } from "@/features/keyboard/keyboard-svg";
import { UntimedPractice } from "@/features/typing/untimed-practice";

export function LessonView({ id }: { id: string }) {
  const { t, lang } = useI18n();
  const repos = useRepos();
  const lesson = lessons.find((l) => l.id === id);
  const [round, setRound] = useState(0);

  const onComplete = useCallback(() => {
    void repos.sentences.mastery(`lesson:${id}`).then((m) => repos.sentences.setMastery(`lesson:${id}`, m + 1));
  }, [repos, id]);

  if (!lesson) return null;
  // Each round practises the drills in a rotated order.
  const drills = [...lesson.drills.slice(round % lesson.drills.length), ...lesson.drills.slice(0, round % lesson.drills.length)];
  const text = drills.join(" ");
  const next = lessons.find((l) => l.order === lesson.order + 1);

  return (
    <Page
      title={lang === "ar" ? lesson.titleAr : lesson.titleEn}
      intro={<span className="block text-hint">{lang === "ar" ? lesson.noteAr : lesson.noteEn}</span>}
      actions={
        next ? (
          <Link href={`/learn/lesson/${next.id}`} className="text-sm font-medium text-brass underline-offset-4 hover:underline">
            {lang === "ar" ? next.titleAr : next.titleEn}
          </Link>
        ) : null
      }
    >
      <div className="space-y-8">
        <KeyboardSvg
          label={`${t.learn.lessonKeys}: ${lesson.keys}`}
          className="mx-auto max-w-2xl md:hidden"
          nextKey={null}
        />
        <UntimedPractice
          key={round}
          text={text}
          source="lesson"
          modeLabel={lang === "ar" ? lesson.titleAr : lesson.titleEn}
          onComplete={onComplete}
          onAgain={() => setRound((r) => r + 1)}
        />
      </div>
    </Page>
  );
}
