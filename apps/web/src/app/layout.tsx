import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import Script from "next/script";
import { AppShell } from "@/components/app-shell";
import { auth } from "@/lib/auth";
import { isScholarPublicHost } from "@/lib/website/public-host";
import "./globals.css";
import "../styles/scholar-static.css";

const APP_METADATA: Metadata = {
  title: "CVScholar",
  description: "Professional academic CV builder with PDF generation and website publishing.",
  icons: {
    icon: "/cvscholar-logo.svg",
    shortcut: "/cvscholar-logo.svg",
    apple: "/cvscholar-logo.svg"
  }
};

/** Public scholar sites must not inherit the CVScholar product favicon. */
const PUBLIC_SITE_METADATA: Metadata = {
  title: "Academic website",
  description: "Academic researcher website hosted on CVScholar.",
  icons: {
    icon: [{ url: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>" }],
    shortcut: undefined,
    apple: undefined
  }
};

const themeInitScript = `(function(){try{var k='cvscholar-sp-theme';var t=localStorage.getItem(k);var d=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;var v=(t==='light'||t==='dark')?t:(d?'dark':'light');document.documentElement.dataset.spTheme=v;}catch(e){}})();`;

export async function generateMetadata(): Promise<Metadata> {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host") || "";
  const siteMode = headerStore.get("x-cvscholar-site-mode");
  const barePublicSite =
    siteMode === "subdomain" || siteMode === "custom-domain" || isScholarPublicHost(host);
  return barePublicSite ? PUBLIC_SITE_METADATA : APP_METADATA;
}

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
