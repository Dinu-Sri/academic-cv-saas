export type PaidPlanKey = "pdf_pass" | "scholar_annual";
export type PlanKey = "free" | PaidPlanKey;

export type BillingPlan = {
  key: PlanKey;
  name: string;
  tagline: string;
  priceUsd: number;
  priceLabel: string;
  periodLabel: string;
  billingDays: number | null;
  highlighted?: boolean;
  ctaLabel: string;
  features: string[];
};

/** Feature flags derived from the active plan (shared client/server). */
export type PlanEntitlements = {
  planKey: PlanKey;
  planName: string;
  isPaid: boolean;
  canDownloadPdf: boolean;
  showPlatformBranding: boolean;
  canConnectCustomDomain: boolean;
  canEnablePublicCvDownload: boolean;
  expiresAt: string | null;
  daysRemaining: number | null;
  cycleLabel: string;
};

/** Client-safe PayHere popup payload (hash generated server-side). */
export type PayHereCheckoutPayload = {
  sandbox: boolean;
  merchant_id: string;
  notify_url: string;
  order_id: string;
  items: string;
  amount: string;
  currency: string;
  hash: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  custom_1: string;
  custom_2: string;
};

/** Shared client/server billing status shape (no server-only imports). */
export type BillingStatusPayload = {
  plans: BillingPlan[];
  subscription: {
    planKey: PlanKey;
    planName: string;
    status: string;
    isPaid: boolean;
    startsAt: string | null;
    expiresAt: string | null;
    daysRemaining: number | null;
    cycleLabel: string;
    /** Paid plan ends within 7 days. */
    isExpiringSoon: boolean;
    /** Free after a paid plan lapsed (previousPlanKey set). */
    justExpired: boolean;
    previousPlanKey: string | null;
    previousPlanName: string | null;
  };
  entitlements: PlanEntitlements;
  payment: {
    /** Live gateway is deferred; UI stops at the final pay button. */
    gatewayReady: boolean;
    configured: boolean;
    sandbox: boolean;
    currency: string;
    devSimulate: boolean;
  };
  recentPayments: {
    id: string;
    orderId: string;
    planKey: string;
    planName: string;
    amount: number;
    currency: string;
    status: string;
    createdAt: string;
  }[];
};

function envNumber(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Catalog prices are USD display amounts. Override via env for staging experiments. */
export function getPlanCatalog(): BillingPlan[] {
  const passPrice = envNumber("CVSCHOLAR_BILLING_PDF_PASS_USD", 5);
  const annualPrice = envNumber("CVSCHOLAR_BILLING_SCHOLAR_ANNUAL_USD", 36);

  return [
    {
      key: "free",
      name: "Free",
      tagline: "Build everything and try the full product.",
      priceUsd: 0,
      priceLabel: "$0",
      periodLabel: "forever",
      billingDays: null,
      ctaLabel: "Current plan",
      features: [
        "Full CV editor & all templates (preview)",
        "ORCID & Google Scholar import",
        "Live academic website with CVScholar badge",
        "Free subdomain (username.cvscholar.com)",
        "PDF on-screen preview only — no download"
      ]
    },
    {
      key: "pdf_pass",
      name: "PDF Pass",
      tagline: "Unlock downloads when you need the official file.",
      priceUsd: passPrice,
      priceLabel: `$${passPrice % 1 === 0 ? passPrice.toFixed(0) : passPrice.toFixed(2)}`,
      periodLabel: "for 30 days",
      billingDays: 30,
      highlighted: true,
      ctaLabel: "Buy now",
      features: [
        "Unlimited PDF downloads for 30 days",
        "All templates in final PDF",
        "No CVScholar branding on website",
        "Everything in Free",
        "Ideal for job / grant deadlines"
      ]
    },
    {
      key: "scholar_annual",
      name: "Scholar Annual",
      tagline: "Your professional academic home for a full year.",
      priceUsd: annualPrice,
      priceLabel: `$${annualPrice % 1 === 0 ? annualPrice.toFixed(0) : annualPrice.toFixed(2)}`,
      periodLabel: "per year",
      billingDays: 365,
      ctaLabel: "Buy now",
      features: [
        "PDF downloads all year",
        "No CVScholar branding on website",
        "Connect your own domain",
        "Higher limits & priority PDF queue",
        "Everything in PDF Pass"
      ]
    }
  ];
}

export function getPaidPlan(key: string): BillingPlan | null {
  if (key !== "pdf_pass" && key !== "scholar_annual") return null;
  return getPlanCatalog().find((p) => p.key === key) ?? null;
}

export function isPaidPlanKey(key: string): key is PaidPlanKey {
  return key === "pdf_pass" || key === "scholar_annual";
}

export function planDisplayName(key: string): string {
  const plan = getPlanCatalog().find((p) => p.key === key);
  return plan?.name ?? "Free";
}

/** API error codes (safe for client + server). */
export const PDF_DOWNLOAD_LOCKED_CODE = "PDF_DOWNLOAD_LOCKED";
export const CUSTOM_DOMAIN_LOCKED_CODE = "CUSTOM_DOMAIN_LOCKED";
