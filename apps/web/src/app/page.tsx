import type { Metadata } from "next";
import { HomeLanding } from "@/components/home-landing";
import { getPublicImpactStats } from "@/lib/public-impact";
import { absoluteUrl } from "@/lib/content/site-url";
import {
  PLATFORM_DEFAULT_DESCRIPTION,
  PLATFORM_NAME,
  defaultOpenGraph,
  defaultTwitter,
  jsonLdGraphScript,
  organizationJsonLd,
  softwareApplicationJsonLd,
  webPageJsonLd,
  webSiteJsonLd
} from "@/lib/seo/platform";

const title = `${PLATFORM_NAME} — Academic CVs and websites in minutes`;
const description = PLATFORM_DEFAULT_DESCRIPTION;
const url = absoluteUrl("/");

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: url },
  openGraph: defaultOpenGraph({ title, description, url, type: "website" }),
  twitter: defaultTwitter({ title, description })
};

export default async function RootPage() {
  const impact = await getPublicImpactStats();
  const jsonLd = jsonLdGraphScript([
    organizationJsonLd(),
    webSiteJsonLd(),
    softwareApplicationJsonLd(),
    webPageJsonLd({ title, description, url })
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd.replace(/</g, "\\u003c") }} />
      <HomeLanding impact={impact} />
    </>
  );
}
