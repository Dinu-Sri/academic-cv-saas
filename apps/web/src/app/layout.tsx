import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import Script from "next/script";
import { AppShell } from "@/components/app-shell";
import { auth } from "@/lib/auth";
import { isScholarPublicHost } from "@/lib/website/public-host";
import "./globals.css";
import "../styles/scholar-static.css";

export const metadata: Metadata = {
  title: "CVScholar",
  description: "Professional academic CV builder with PDF generation and website publishing.",
  icons: {
    icon: "/cvscholar-logo.svg",
    shortcut: "/cvscholar-logo.svg",
    apple: "/cvscholar-logo.svg"
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
  const barePublicSite =
    siteMode === "subdomain" || siteMode === "custom-domain" || isScholarPublicHost(host);
  const session = barePublicSite ? null : await auth.api.getSession({ headers: headerStore });

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={barePublicSite ? "website-public-body" : undefined}>
        <Script id="sp-theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        {barePublicSite ? children : <AppShell initialIsAuthenticated={Boolean(session?.user)}>{children}</AppShell>}
      </body>
    </html>
  );
}
