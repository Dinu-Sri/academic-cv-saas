import type { Metadata } from "next";
import { LegalPageView } from "@/components/marketing/legal-page-view";
import { getLegalPage } from "@/lib/content/legal";
import { absoluteUrl } from "@/lib/content/site-url";

const page = getLegalPage("terms");

export const metadata: Metadata = {
  title: `${page.title} | CVScholar`,
  description: page.description,
  alternates: { canonical: absoluteUrl("/terms") }
};

export default function TermsPage() {
  return <LegalPageView page={page} />;
}
