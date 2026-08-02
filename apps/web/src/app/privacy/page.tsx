import type { Metadata } from "next";
import { LegalPageView } from "@/components/marketing/legal-page-view";
import { getLegalPage } from "@/lib/content/legal";
import { absoluteUrl } from "@/lib/content/site-url";

const page = getLegalPage("privacy");

export const metadata: Metadata = {
  title: `${page.title} | CVScholar`,
  description: page.description,
  alternates: { canonical: absoluteUrl("/privacy") },
  openGraph: {
    title: page.title,
    description: page.description,
    url: absoluteUrl("/privacy"),
    type: "website",
    siteName: "CVScholar"
  },
  robots: { index: true, follow: true }
};

export default function PrivacyPage() {
  return <LegalPageView page={page} />;
}
