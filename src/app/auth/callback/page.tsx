import { Suspense } from "react";
import { ScreenPlaceholder } from "@/components/page";
import { CallbackView } from "./callback-view";

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<ScreenPlaceholder />}>
      <CallbackView />
    </Suspense>
  );
}
