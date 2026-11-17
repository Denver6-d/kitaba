"use client";

import type { ReactNode } from "react";
import { I18nProvider } from "@/i18n";
import { RepositoriesProvider } from "@/repositories/provider";
import { ServiceWorkerRegistration } from "./service-worker";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <RepositoriesProvider>
        {children}
        <ServiceWorkerRegistration />
      </RepositoriesProvider>
    </I18nProvider>
  );
}
