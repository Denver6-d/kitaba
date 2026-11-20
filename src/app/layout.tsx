import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/shell/site-header";
import { SiteFooter } from "@/components/shell/site-footer";
import { BottomNav } from "@/components/shell/bottom-nav";
import { PRE_PAINT_SCRIPT } from "@/lib/settings";
import { ar } from "@/i18n/ar";
import { PRODUCT_NAME } from "@/config/brand";
import { CANVAS } from "@/config/theme";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: ar.meta.title,
  description: ar.meta.description,
  applicationName: PRODUCT_NAME,
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
  appleWebApp: { capable: true, title: PRODUCT_NAME, statusBarStyle: "black" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Phones shrink the layout when the keyboard opens, so the answer and the Check button stay visible.
  interactiveWidget: "resizes-content",
  colorScheme: "dark",
  themeColor: CANVAS,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // lang and dir are corrected before paint by PRE_PAINT_SCRIPT from the saved settings.
    <html lang="ar" dir="rtl" className={fontVariables} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PRE_PAINT_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col antialiased">
        <Providers>
          <SiteHeader />
          <main id="main" tabIndex={-1} className="flex-1 outline-none">
            {children}
          </main>
          <SiteFooter />
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
