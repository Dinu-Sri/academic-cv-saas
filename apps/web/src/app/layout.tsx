import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import Script from "next/script";
import { AppShell } from "@/components/app-shell";
import { isScholarPublicHost } from "@/lib/website/public-host";
import "./globals.css";

export const metadata: Metadata = {
  title: "CVScholar",
  description: "Professional academic CV builder with PDF generation and website publishing.",
  icons: {
    icon: "/favicon.webp",
    shortcut: "/favicon.webp",
    apple: "/favicon.webp"
  }
};

const themeInitScript = `(function(){try{var k='cvscholar-sp-theme';var t=localStorage.getItem(k);var d=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;var v=(t==='light'||t==='dark')?t:(d?'dark':'light');document.documentElement.dataset.spTheme=v;}catch(e){}})();`;

export default async function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host") || "";
  const siteMode = headerStore.get("x-cvscholar-site-mode");
  // Scholar public sites: no CVScholar app chrome (sidebar, top bar, status rail).
  const barePublicSite = siteMode === "subdomain" || isScholarPublicHost(host);

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={barePublicSite ? "website-public-body" : undefined}>
        <Script id="sp-theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        {barePublicSite ? children : <AppShell>{children}</AppShell>}
      </body>
    </html>
  );
}
