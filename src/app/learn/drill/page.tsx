import { Suspense } from "react";
import { DrillView } from "./drill-view";

export default function DrillPage() {
  // useSearchParams (in DrillView) needs a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <DrillView />
    </Suspense>
  );
}
