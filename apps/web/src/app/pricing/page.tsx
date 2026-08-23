import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { ProductFooter } from "@/components/marketing/product-footer";
import { getPlanCatalog } from "@/lib/billing/plans";
import { absoluteUrl } from "@/lib/content/site-url";
import {
  PLATFORM_NAME,
  breadcrumbListJsonLd,
  defaultOpenGraph,
  defaultTwitter,
  jsonLdGraphScript,
  softwareApplicationJsonLd,
  webPageJsonLd
} from "@/lib/seo/platform";

export const dynamic = "force-dynamic";

const title = `Pricing | ${PLATFORM_NAME}`;
const description =
  "Build free. Unlock PDF downloads with PDF Pass, or Scholar Annual for custom domains and unbranded academic websites.";
const url = absoluteUrl("/pricing");

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: url },
  openGraph: defaultOpenGraph({ title, description, url }),
  twitter: defaultTwitter({ title, description })
};

export default function PricingPage() {
  const plans = getPlanCatalog();
  const jsonLd = jsonLdGraphScript([
    softwareApplicationJsonLd(),
    webPageJsonLd({ title, description, url }),
    breadcrumbListJsonLd([
      { name: "Home", url: absoluteUrl("/") },
      { name: "Pricing", url }
    ])
  ]);

  return (
    <article className="marketing-page pricing-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd.replace(/</g, "\\u003c") }} />
      <header className="pricing-header">
        <span className="section-label">Simple pricing</span>
        <h1>Build free. Pay when the finished file or advanced website features matter.</h1>
        <p>No card is required to build your CV or publish a CVScholar-branded academic website.</p>
      </header>

      <section className="pricing-grid" aria-label="CVScholar plans">
        {plans.map((plan) => (
          <article className={`pricing-plan ${plan.highlighted ? "is-highlighted" : ""}`} key={plan.key}>
            <div className="pricing-plan-head">
              <span>{plan.name}</span>
              <div>
                <strong>{plan.priceLabel}</strong>
                <small>{plan.periodLabel}</small>
              </div>
              <p>{plan.tagline}</p>
            </div>
            <ul>
              {plan.features.map((feature) => (
                <li key={feature}>
                  <Check size={16} />
                  {feature}
                </li>
              ))}
            </ul>
            <Link
              className={plan.highlighted ? "primary-action" : "secondary-action"}
              href={plan.key === "free" ? "/profile" : `/billing?plan=${plan.key}`}
            >
              {plan.key === "free" ? "Start building free" : `Choose ${plan.name}`}
            </Link>
          </article>
        ))}
      </section>
      <ProductFooter />
    </article>
  );
}
