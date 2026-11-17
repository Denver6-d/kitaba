import { Suspense } from "react";
import { WelcomeView } from "./welcome-view";

export default function WelcomePage() {
  return (
    <Suspense fallback={null}>
      <WelcomeView />
    </Suspense>
  );
}
