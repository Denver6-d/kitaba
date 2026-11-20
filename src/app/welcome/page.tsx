import { Suspense } from "react";
import { ScreenPlaceholder } from "@/components/page";
import { WelcomeView } from "./welcome-view";

export default function WelcomePage() {
  return (
    <Suspense fallback={<ScreenPlaceholder />}>
      <WelcomeView />
    </Suspense>
  );
}
