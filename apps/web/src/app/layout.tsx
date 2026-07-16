import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
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
    <html lang="en">
      <body className={barePublicSite ? "website-public-body" : undefined}>
        {barePublicSite ? children : <AppShell>{children}</AppShell>}
      </body>
    </html>
  );
}
