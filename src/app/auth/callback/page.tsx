import { Suspense } from "react";
import { CallbackView } from "./callback-view";

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <CallbackView />
    </Suspense>
  );
}
