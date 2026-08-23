import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import Script from "next/script";
import { AppShell } from "@/components/app-shell";
import { MetaPixel } from "@/components/meta-pixel";
import { MicrosoftClarity } from "@/components/microsoft-clarity";
import { auth } from "@/lib/auth";
import {
  getClarityProjectId,
  isClarityEnabled,
  isClarityPublicSitesEnabled
} from "@/lib/clarity/config";
import { getMetaPixelId, isMetaTrackingEnabled } from "@/lib/meta/config";
import { isScholarPublicHost } from "@/lib/website/public-host";
import "./globals.css";
import "../styles/scholar-static.css";

function appMetadataBase(): URL {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "https://cvscholar.com");
  } catch {
    return new URL("https://cvscholar.com");
  }
}

const APP_METADATA: Metadata = {
  metadataBase: appMetadataBase(),
  title: {
    default: "CVScholar — Academic CVs and websites",
    template: "%s | CVScholar"
  },
  description:
    "The academic CV builder for researchers, professors, and PhD students. Real LaTeX PDFs, ORCID and Google Scholar import, and free academic websites from your CV.",
  applicationName: "CVScholar",
  icons: {
    icon: "/cvscholar-logo.svg",
    shortcut: "/cvscholar-logo.svg",
    apple: "/cvscholar-logo.svg"
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "CVScholar",
    title: "CVScholar — Academic CVs and websites",
    description:
      "The academic CV builder for researchers, professors, and PhD students. Real LaTeX PDFs, ORCID and Google Scholar import, and free academic websites from your CV.",
    images: [{ url: "/cvscholar-logo.svg", alt: "CVScholar" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "CVScholar — Academic CVs and websites",
    description:
      "The academic CV builder for researchers, professors, and PhD students. Real LaTeX PDFs, ORCID and Google Scholar import, and free academic websites from your CV.",
    images: ["/cvscholar-logo.svg"]
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
  // Meta Pixel only on the main product host — never on scholar public sites.
  const metaPixelId = !barePublicSite && isMetaTrackingEnabled() ? getMetaPixelId() : "";
  // Clarity: product host always when enabled; public scholar sites when CLARITY_PUBLIC_SITES_ENABLED=1 (default).
  const clarityProjectId =
    isClarityEnabled() && (!barePublicSite || isClarityPublicSitesEnabled())
      ? getClarityProjectId()
      : "";

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={barePublicSite ? "website-public-body" : undefined}>
        <Script id="sp-theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        {metaPixelId ? <MetaPixel pixelId={metaPixelId} enabled /> : null}
        {clarityProjectId ? (
          <MicrosoftClarity
            projectId={clarityProjectId}
            siteMode={barePublicSite ? "public_scholar" : "product"}
            enabled
          />
        ) : null}
        {barePublicSite ? children : <AppShell initialIsAuthenticated={Boolean(session?.user)}>{children}</AppShell>}
      </body>
    </html>
  );
}
