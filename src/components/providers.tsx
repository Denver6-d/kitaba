"use client";

import type { ReactNode } from "react";
import { I18nProvider } from "@/i18n";
import { RepositoriesProvider } from "@/repositories/provider";
import { ServiceWorkerRegistration } from "./service-worker";
import { AchievementToast } from "@/features/rewards/achievement-toast";
import { AccountProvider } from "@/features/account/account-provider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <RepositoriesProvider>
        <AccountProvider>
          {children}
          <ServiceWorkerRegistration />
          <AchievementToast />
        </AccountProvider>
      </RepositoriesProvider>
    </I18nProvider>
  );
}
