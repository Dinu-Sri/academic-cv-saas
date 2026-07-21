import type { Metadata } from "next";
import { LegalPageView } from "@/components/marketing/legal-page-view";
import { getLegalPage } from "@/lib/content/legal";
import { absoluteUrl } from "@/lib/content/site-url";

const page = getLegalPage("refund");

export const metadata: Metadata = {
  title: `${page.title} | CVScholar`,
  description: page.description,
  alternates: { canonical: absoluteUrl("/refund-policy") }
};

export default function RefundPolicyPage() {
  return <LegalPageView page={page} />;
}
