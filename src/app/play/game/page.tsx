import { Suspense } from "react";
import { GameView } from "./game-view";

export default function GamePage() {
  return (
    <Suspense fallback={null}>
      <GameView />
    </Suspense>
  );
}
