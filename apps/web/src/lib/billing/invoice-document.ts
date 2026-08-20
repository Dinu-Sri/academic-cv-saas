/**
 * Beautiful A4 corporate invoice HTML generator.
 * Clean academic style for Clossyan Technologies (Pvt) Ltd / CVScholar.
 */

import { COMPANY, COMPANY_LEGAL_LINKS, INVOICE_LEGAL_FOOTER } from "@/lib/billing/company";
import { planDisplayName } from "@/lib/billing/plans";
import { getSiteOrigin } from "@/lib/content/site-url";

export type InvoiceDocumentInput = {
  orderId: string;
  planKey: string;
  amount: number;
  currency: string;
  status: string;
  paidAt: Date | string;
  /** Customer / bill-to */
  billTo: {
    name: string;
    email: string;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    country?: string | null;
  };
  /** PayHere payment id when paid */
  payherePaymentId?: string | null;
  /** Discount applied at checkout */
  discountCode?: string | null;
  discountAmount?: number | null;
  originalAmount?: number | null;
  /** Admin complimentary award */
  complimentary?: boolean;
  complimentaryNote?: string | null;
  /** Absolute logo URL for print (email clients / print) */
  logoAbsoluteUrl?: string;
  /** Show on-screen print actions */
  showActions?: boolean;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMoney(amount: number, currency: string) {
  const n = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2
    }).format(n);
  } catch {
    return `${currency || "USD"} ${n.toFixed(2)}`;
  }
}

function formatDate(value: Date | string) {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function billToBlock(billTo: InvoiceDocumentInput["billTo"]) {
  const lines = [
    billTo.name,
    billTo.email,
    billTo.phone,
    billTo.address,
    [billTo.city, billTo.country].filter(Boolean).join(", ")
  ]
    .filter((line) => line && String(line).trim())
    .map((line) => escapeHtml(String(line).trim()));
  return lines.join("<br/>");
}

function paymentMethodLabel(input: InvoiceDocumentInput) {
  if (input.complimentary) {
    return "Complimentary award — free of charge (awarded by Clossyan Technologies (Pvt) Ltd)";
  }
  if (input.amount === 0 && input.discountCode) {
    return `Covered by discount code ${escapeHtml(input.discountCode)} — no payment collected`;
  }
  if (input.payherePaymentId) {
    return `Paid via PayHere · Payment ID ${escapeHtml(input.payherePaymentId)}`;
  }
  if (input.amount === 0) {
    return "Complimentary award — free of charge";
  }
  return "Paid via PayHere";
}

function linkifyLegalParagraph(para: string) {
  let html = escapeHtml(para);
  // Longest URLs first so https://cvscholar.com does not break /terms|/privacy|/refund-policy.
  const urls = [
    COMPANY_LEGAL_LINKS.termsUrl,
    COMPANY_LEGAL_LINKS.privacyUrl,
    COMPANY_LEGAL_LINKS.refundUrl,
    COMPANY.productWebsite
  ].sort((a, b) => b.length - a.length);
  for (const url of urls) {
    const escaped = escapeHtml(url);
    const parts = html.split(escaped);
    html = parts
      .map((part, index) => {
        if (index === parts.length - 1) return part;
        // Skip if this occurrence was already turned into an anchor href.
        if (part.endsWith('href="') || part.endsWith("href='")) {
          return part + escaped;
        }
        return `${part}<a href="${url}">${escaped}</a>`;
      })
      .join("");
  }
  const emailEscaped = escapeHtml(COMPANY.email);
  html = html.split(emailEscaped).join(`<a href="mailto:${COMPANY.email}">${emailEscaped}</a>`);
  return html.replace(/\n/g, "<br/>");
}

/**
 * Generate a clean academic-corporate A4 invoice document (HTML).
 */
export function buildInvoiceDocumentHtml(input: InvoiceDocumentInput): string {
  const origin = getSiteOrigin();
  const logoUrl = input.logoAbsoluteUrl || `${origin}${COMPANY.logoPath}`;
  const planName = planDisplayName(input.planKey);
  const currency = input.currency || COMPANY.currency;
  const money = formatMoney(input.amount, currency);
  const isComplimentary = Boolean(input.complimentary || (input.amount === 0 && !input.discountCode));
  const showActions = input.showActions !== false;
  const statusLabel = isComplimentary
    ? "Complimentary"
    : input.amount === 0
      ? "Paid (discount)"
      : input.status === "completed"
        ? "Paid"
        : escapeHtml(input.status);

  const legalHtml = INVOICE_LEGAL_FOOTER.split("\n\n")
    .map((para) => `<p>${linkifyLegalParagraph(para)}</p>`)
    .join("\n");

  const complimentaryBanner = isComplimentary
    ? `<div class="complimentary-banner">
        <strong>Complimentary award</strong>
        <span>This package was awarded by Clossyan Technologies (Pvt) Ltd free of charge.${
          input.complimentaryNote
            ? ` ${escapeHtml(input.complimentaryNote)}`
            : ""
        }</span>
      </div>`
    : "";

  const discountRows =
    input.discountAmount && input.discountAmount > 0
      ? `<tr>
          <td class="label">Discount${
            input.discountCode ? ` (${escapeHtml(input.discountCode)})` : ""
          }</td>
          <td class="value">−${escapeHtml(formatMoney(input.discountAmount, currency))}</td>
        </tr>`
      : "";

  const subtotalAmount =
    input.originalAmount != null && Number.isFinite(input.originalAmount)
      ? input.originalAmount
      : input.amount + (input.discountAmount || 0);

  const actions = showActions
    ? `<div class="no-print actions">
        <button type="button" onclick="window.print()">Print / Save as PDF</button>
        <a class="btn secondary" href="/billing">Back to Billing</a>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtml(COMPANY.invoiceTitle)} ${escapeHtml(input.orderId)} · ${escapeHtml(COMPANY.tradingName)}</title>
  <style>
    @page {
      size: A4;
      margin: 14mm 14mm 16mm;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #e8eef5;
      color: #1b2a4a;
      font-family: "Segoe UI", Calibri, "Helvetica Neue", Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    a { color: #2b6cb0; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .sheet-wrap {
      padding: 24px 12px 40px;
    }
    .sheet {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      background: #fff;
      box-shadow: 0 18px 50px rgba(27, 42, 74, 0.12);
      padding: 16mm 16mm 14mm;
      display: flex;
      flex-direction: column;
      position: relative;
    }
    .sheet::before {
      content: "";
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 6px;
      background: linear-gradient(90deg, #1b2a4a 0%, #2b6cb0 55%, #4f8fbf 100%);
    }
    .header {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      align-items: flex-start;
      padding-bottom: 16px;
      border-bottom: 1px solid #e2e8f0;
    }
    .brand {
      display: flex;
      gap: 14px;
      align-items: flex-start;
      min-width: 0;
    }
    .brand img {
      width: 52px;
      height: 52px;
      object-fit: contain;
      flex-shrink: 0;
    }
    .brand-text strong {
      display: block;
      font-size: 1.15rem;
      letter-spacing: 0.02em;
      color: #1b2a4a;
    }
    .brand-text .legal {
      margin-top: 2px;
      font-size: 0.78rem;
      color: #5a6a85;
      line-height: 1.45;
    }
    .doc-meta {
      text-align: right;
      flex-shrink: 0;
    }
    .doc-meta .title {
      display: inline-block;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #fff;
      background: #1b2a4a;
      padding: 6px 10px;
      border-radius: 4px;
      margin-bottom: 10px;
    }
    .doc-meta dl {
      margin: 0;
      text-align: right;
      font-size: 0.82rem;
      line-height: 1.55;
    }
    .doc-meta dt {
      display: inline;
      color: #5a6a85;
      font-weight: 500;
    }
    .doc-meta dd {
      display: inline;
      margin: 0 0 0 6px;
      font-weight: 650;
      color: #1b2a4a;
    }
    .doc-meta .meta-row { margin: 0; }
    .parties {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin: 22px 0 8px;
    }
    .party h2 {
      margin: 0 0 8px;
      font-size: 0.72rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #5a6a85;
      font-weight: 700;
    }
    .party p {
      margin: 0;
      font-size: 0.92rem;
      line-height: 1.5;
    }
    .complimentary-banner {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin: 8px 0 18px;
      padding: 12px 14px;
      border-radius: 10px;
      background: #f3f7fb;
      border: 1px solid #c5d6ea;
    }
    .complimentary-banner strong {
      font-size: 0.78rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #2b6cb0;
    }
    .complimentary-banner span {
      font-size: 0.88rem;
      color: #1b2a4a;
      line-height: 1.45;
    }
    .status-pill {
      display: inline-block;
      padding: 3px 9px;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      background: #e8f6ee;
      color: #1e9e5a;
    }
    .status-pill.is-comp {
      background: #ebf4fb;
      color: #2b6cb0;
    }
    .items {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0 18px;
    }
    .items th {
      background: #1b2a4a;
      color: #fff;
      font-size: 0.72rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 10px 12px;
      font-weight: 650;
    }
    .items td {
      padding: 12px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 0.92rem;
      vertical-align: top;
    }
    .items tr:last-child td { border-bottom: 0; }
    .items .num { text-align: right; white-space: nowrap; }
    .totals {
      margin-left: auto;
      width: min(280px, 100%);
      border-collapse: collapse;
    }
    .totals td {
      padding: 8px 0;
      font-size: 0.9rem;
    }
    .totals .label { color: #5a6a85; }
    .totals .value { text-align: right; font-weight: 650; }
    .totals .grand td {
      border-top: 2px solid #1b2a4a;
      padding-top: 12px;
      font-size: 1.05rem;
      font-weight: 750;
      color: #1b2a4a;
    }
    .pay-method {
      margin: 18px 0 8px;
      padding: 12px 14px;
      border-radius: 10px;
      background: #f5f8fc;
      border: 1px solid #d9e4f0;
      font-size: 0.88rem;
      line-height: 1.45;
    }
    .footer {
      margin-top: auto;
      padding-top: 18px;
      border-top: 1px solid #e2e8f0;
      font-size: 0.72rem;
      color: #5a6a85;
      line-height: 1.55;
    }
    .footer p { margin: 0 0 8px; }
    .footer p:last-child { margin-bottom: 0; }
    .footer a { color: #2b6cb0; }
    .company-slim {
      margin-top: 10px;
      font-size: 0.72rem;
      color: #5a6a85;
      line-height: 1.45;
    }
    .no-print.actions {
      width: 210mm;
      margin: 16px auto 0;
      display: flex;
      gap: 10px;
      justify-content: center;
    }
    .no-print button, .no-print .btn {
      background: #2b6cb0;
      color: #fff;
      border: 0;
      border-radius: 8px;
      padding: 10px 14px;
      text-decoration: none;
      font: inherit;
      cursor: pointer;
    }
    .no-print .btn.secondary {
      background: #fff;
      color: #1b2a4a;
      border: 1px solid #c5d0de;
    }
    @media print {
      html, body { background: #fff; }
      .sheet-wrap { padding: 0; }
      .sheet {
        width: auto;
        min-height: auto;
        box-shadow: none;
        padding: 0;
      }
      .no-print { display: none !important; }
    }
    @media (max-width: 900px) {
      .sheet { width: 100%; min-height: auto; }
      .parties { grid-template-columns: 1fr; }
      .header { flex-direction: column; }
      .doc-meta { text-align: left; }
      .doc-meta dl { text-align: left; }
      .no-print.actions { width: 100%; }
    }
  </style>
</head>
<body>
  <div class="sheet-wrap">
    <article class="sheet">
      <header class="header">
        <div class="brand">
          <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(COMPANY.tradingName)}" width="52" height="52"/>
          <div class="brand-text">
            <strong>${escapeHtml(COMPANY.tradingName)}</strong>
            <div class="legal">
              ${escapeHtml(COMPANY.legalName)}<br/>
              ${COMPANY.addressLines.map((l) => escapeHtml(l)).join("<br/>")}<br/>
              Company No. ${escapeHtml(COMPANY.registrationNumber)} · TIN ${escapeHtml(COMPANY.tin)}<br/>
              <a href="mailto:${COMPANY.email}">${escapeHtml(COMPANY.email)}</a>
              · <a href="${COMPANY.website}">${escapeHtml(COMPANY.website.replace(/^https?:\/\//, ""))}</a>
            </div>
          </div>
        </div>
        <div class="doc-meta">
          <div class="title">${escapeHtml(COMPANY.invoiceTitle)}</div>
          <dl>
            <div class="meta-row"><dt>Invoice No.</dt><dd>${escapeHtml(input.orderId)}</dd></div>
            <div class="meta-row"><dt>Date</dt><dd>${escapeHtml(formatDate(input.paidAt))}</dd></div>
            <div class="meta-row"><dt>Status</dt><dd><span class="status-pill ${isComplimentary ? "is-comp" : ""}">${statusLabel}</span></dd></div>
            <div class="meta-row"><dt>Currency</dt><dd>${escapeHtml(currency)}</dd></div>
          </dl>
        </div>
      </header>

      <div class="parties">
        <div class="party">
          <h2>Bill to</h2>
          <p>${billToBlock(input.billTo) || "—"}</p>
        </div>
        <div class="party">
          <h2>Issued by</h2>
          <p>
            ${escapeHtml(COMPANY.legalName)}<br/>
            Trading as ${escapeHtml(COMPANY.tradingName)}<br/>
            ${COMPANY.addressLines.map((l) => escapeHtml(l)).join("<br/>")}<br/>
            <a href="mailto:${COMPANY.email}">${escapeHtml(COMPANY.email)}</a>
          </p>
        </div>
      </div>

      ${complimentaryBanner}

      <table class="items" aria-label="Invoice line items">
        <thead>
          <tr>
            <th style="width:52%">Description</th>
            <th>Qty</th>
            <th class="num">Unit</th>
            <th class="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>${escapeHtml(planName)}</strong><br/>
              <span style="color:#5a6a85;font-size:0.82rem;">Digital academic CV / website plan · CVScholar SaaS</span>
            </td>
            <td>1</td>
            <td class="num">${escapeHtml(formatMoney(subtotalAmount, currency))}</td>
            <td class="num">${escapeHtml(formatMoney(subtotalAmount, currency))}</td>
          </tr>
        </tbody>
      </table>

      <table class="totals" aria-label="Totals">
        <tr>
          <td class="label">Subtotal</td>
          <td class="value">${escapeHtml(formatMoney(subtotalAmount, currency))}</td>
        </tr>
        ${discountRows}
        <tr>
          <td class="label">VAT</td>
          <td class="value">${escapeHtml(formatMoney(0, currency))}</td>
        </tr>
        <tr class="grand">
          <td class="label">Total</td>
          <td class="value">${escapeHtml(money)}</td>
        </tr>
      </table>

      <div class="pay-method">
        <strong>Payment method.</strong>
        ${paymentMethodLabel(input)}
      </div>

      <footer class="footer">
        ${legalHtml}
        <div class="company-slim">
          ${escapeHtml(COMPANY.legalName)} · Company No. ${escapeHtml(COMPANY.registrationNumber)} · TIN ${escapeHtml(COMPANY.tin)} · ${escapeHtml(COMPANY.email)}
        </div>
      </footer>
    </article>
    ${actions}
  </div>
</body>
</html>`;
}
