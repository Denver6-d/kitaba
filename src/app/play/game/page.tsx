import { Suspense } from "react";
import { ScreenPlaceholder } from "@/components/page";
import { GameView } from "./game-view";

export default function GamePage() {
  return (
    <Suspense fallback={<ScreenPlaceholder />}>
      <GameView />
    </Suspense>
  );
}
