/** Plans a customer can buy today. */
export type PurchasablePlanKey = "scholar_annual";
/** Kept so existing subscriptions and payments still resolve. Not offered for sale. */
export type LegacyPaidPlanKey = "pdf_pass";
export type PaidPlanKey = PurchasablePlanKey | LegacyPaidPlanKey;
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
  /** Scholar Annual support tickets are filed at high priority. */
  prioritySupport: boolean;
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
    invoiceName: string | null;
    invoiceEmail: string | null;
    canDownloadInvoice: boolean;
    canDismiss: boolean;
    canRetry: boolean;
    /** Admin / company complimentary award (amount 0, source admin_grant). */
    complimentary: boolean;
    discountCode: string | null;
  }[];
  /** Prefill for checkout invoice form */
  invoiceDefaults: {
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    country: string;
  };
};

/** Checkout invoice / billing contact captured before PayHere. */
export type BillingInvoiceInput = {
  name: string;
  email: string;
  phone?: string;
  address: string;
  city: string;
  country: string;
};

function envNumber(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Catalog prices are USD display amounts. Override via env for staging experiments. */
const LEGACY_PLAN_NAMES: Record<string, string> = {
  pdf_pass: "PDF Pass"
};

export function getPlanCatalog(): BillingPlan[] {
  const annualPrice = envNumber("CVSCHOLAR_BILLING_SCHOLAR_ANNUAL_USD", 36);

  return [
    {
      key: "free",
      name: "Free",
      tagline: "Build your CV, download the PDF, and publish your academic website.",
      priceUsd: 0,
      priceLabel: "$0",
      periodLabel: "forever",
      billingDays: null,
      ctaLabel: "Current plan",
      features: [
        "Unlimited PDF downloads",
        "Full CV editor and templates",
        "ORCID and Google Scholar import",
        "Academic website on your CVScholar subdomain",
        "“Built with CVScholar” on the public website"
      ]
    },
    {
      key: "scholar_annual",
      name: "Scholar Annual",
      tagline: "Your own domain, direct support, and an unbranded academic website.",
      priceUsd: annualPrice,
      priceLabel: `$${annualPrice % 1 === 0 ? annualPrice.toFixed(0) : annualPrice.toFixed(2)}`,
      periodLabel: "per year",
      billingDays: 365,
      highlighted: true,
      ctaLabel: "Choose Scholar Annual",
      features: [
        "Everything in Free, including unlimited PDFs",
        "No CVScholar branding on your website",
        "Connect your own domain",
        "Direct, faster customer support"
      ]
    }
  ];
}

export function getPaidPlan(key: string): BillingPlan | null {
  if (key !== "scholar_annual") return null;
  return getPlanCatalog().find((p) => p.key === key) ?? null;
}

/** Includes the retired PDF Pass so in-flight payments and active passes still resolve. */
export function isPaidPlanKey(key: string): key is PaidPlanKey {
  return key === "pdf_pass" || key === "scholar_annual";
}

export function isPurchasablePlanKey(key: string): key is PurchasablePlanKey {
  return key === "scholar_annual";
}

export function planDisplayName(key: string): string {
  const plan = getPlanCatalog().find((p) => p.key === key);
  return plan?.name ?? LEGACY_PLAN_NAMES[key] ?? "Free";
}

/** API error codes (safe for client + server). */
export const PDF_DOWNLOAD_LOCKED_CODE = "PDF_DOWNLOAD_LOCKED";
export const CUSTOM_DOMAIN_LOCKED_CODE = "CUSTOM_DOMAIN_LOCKED";
