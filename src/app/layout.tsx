import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/shell/site-header";
import { SiteFooter } from "@/components/shell/site-footer";
import { PRE_PAINT_SCRIPT } from "@/lib/settings";
import { ar } from "@/i18n/ar";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: ar.meta.title,
  description: ar.meta.description,
  applicationName: "Kitaba",
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
  appleWebApp: { capable: true, title: "Kitaba", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef1ec" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1c1b" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // lang/dir/theme are corrected before paint by PRE_PAINT_SCRIPT from the saved settings.
    <html lang="ar" dir="rtl" data-theme="light" className={fontVariables} suppressHydrationWarning>
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
        </Providers>
      </body>
    </html>
  );
}
