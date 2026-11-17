import { notFound } from "next/navigation";
import { scenarios } from "@/data/scenarios";
import { ScenarioWriter } from "./scenario-writer";

export function generateStaticParams() {
  return scenarios.map((s) => ({ id: s.id }));
}

export default async function ScenarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!scenarios.some((s) => s.id === id)) notFound();
  return <ScenarioWriter id={id} />;
}
