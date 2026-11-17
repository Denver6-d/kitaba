"use client";

import type { ReactNode } from "react";
import { I18nProvider } from "@/i18n";
import { RepositoriesProvider } from "@/repositories/provider";
import { ServiceWorkerRegistration } from "./service-worker";
import { AchievementToast } from "@/features/rewards/achievement-toast";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <RepositoriesProvider>
        {children}
        <ServiceWorkerRegistration />
        <AchievementToast />
      </RepositoriesProvider>
    </I18nProvider>
  );
}
