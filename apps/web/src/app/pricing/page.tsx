import Link from "next/link";
import { Check } from "lucide-react";
import { ProductFooter } from "@/components/marketing/product-footer";
import { getPlanCatalog } from "@/lib/billing/plans";

export const dynamic = "force-dynamic";

export default function PricingPage() {
  const plans = getPlanCatalog();

  return (
    <article className="marketing-page pricing-page">
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
              <div><strong>{plan.priceLabel}</strong><small>{plan.periodLabel}</small></div>
              <p>{plan.tagline}</p>
            </div>
            <ul>
              {plan.features.map((feature) => (
                <li key={feature}><Check size={16} />{feature}</li>
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

      <p className="pricing-note">Prices are shown in USD. Paid access starts only after a successful checkout.</p>
      <ProductFooter />
    </article>
  );
}
