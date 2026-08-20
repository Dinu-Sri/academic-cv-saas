/**
 * Issuer company identity for invoices and billing documents.
 * Source: Clossyan Technologies (Pvt) Ltd / CVScholar brand.
 */

export const COMPANY = {
  legalName: "Clossyan Technologies (Pvt) Ltd",
  tradingName: "CVScholar",
  addressLines: ["78/A2, Pattiyagama", "Madampe, 61230", "Sri Lanka"],
  registrationNumber: "PV00272084",
  tin: "103500176",
  email: "info@clossyan.com",
  website: "https://clossyan.com",
  productWebsite: "https://cvscholar.com",
  logoPath: "/cvscholar-logo.svg",
  /** Title preferred: INVOICE (not TAX INVOICE) — VAT is not charged. */
  invoiceTitle: "INVOICE",
  currency: "USD",
  chargesVat: false
} as const;

/** Terms and refund policy paths on the product host. */
export const COMPANY_LEGAL_LINKS = {
  termsPath: "/terms",
  refundPath: "/refund-policy",
  privacyPath: "/privacy",
  termsUrl: "https://cvscholar.com/terms",
  refundUrl: "https://cvscholar.com/refund-policy",
  privacyUrl: "https://cvscholar.com/privacy"
} as const;

/**
 * Legal footer for all invoices (paid, complimentary, admin awards).
 * Validate with product owner; edit here to change every invoice.
 */
export const INVOICE_LEGAL_FOOTER = [
  "This document is a computer-generated INVOICE for digital academic services provided via CVScholar (https://cvscholar.com), operated by Clossyan Technologies (Pvt) Ltd. All amounts are stated in United States Dollars (USD). VAT is not charged on these services.",
  "Where payment applies, it is processed securely by PayHere. Complimentary plan awards granted by Clossyan Technologies (Pvt) Ltd are provided free of charge, have no cash value, are non-transferable, and are issued at the company’s sole discretion.",
  "CVScholar is a software-as-a-service product. Entitlements (including PDF download and academic website features) apply for the period stated on this invoice and are subject to our Terms of Service, Privacy Policy, and Refund Policy: https://cvscholar.com/terms · https://cvscholar.com/privacy · https://cvscholar.com/refund-policy",
  "This invoice does not require a handwritten signature. Digital delivery of the purchased plan constitutes fulfilment of the digital service. For billing or support enquiries, contact info@clossyan.com."
].join("\n\n");
