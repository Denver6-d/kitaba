import { notFound } from "next/navigation";
import { lessons } from "@/data/lessons";
import { LessonView } from "./lesson-view";

export function generateStaticParams() {
  return lessons.map((l) => ({ id: l.id }));
}

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lesson = lessons.find((l) => l.id === id);
  if (!lesson) notFound();
  return <LessonView id={lesson.id} />;
}
