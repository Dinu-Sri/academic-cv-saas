import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { planDisplayName } from "@/lib/billing/plans";
import { getBillingPaymentForUserInvoice } from "@/lib/billing/service";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Printable HTML invoice for a completed payment (Save as PDF from the browser).
 */
export async function GET(_request: Request, context: { params: Promise<{ orderId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Please login first." }, { status: 401 });
  }

  const { orderId } = await context.params;
  const payment = await getBillingPaymentForUserInvoice(session.user, orderId);
  if (!payment) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  const planName = planDisplayName(payment.planKey);
  const amount = Number(payment.amount).toFixed(2);
  const paidAt = payment.updatedAt.toISOString().slice(0, 10);
  const billTo = [
    payment.invoiceName || session.user.name || "",
    payment.invoiceEmail || session.user.email || "",
    payment.invoicePhone || "",
    payment.invoiceAddress || "",
    [payment.invoiceCity, payment.invoiceCountry].filter(Boolean).join(", ")
  ]
    .filter(Boolean)
    .map((line) => escapeHtml(line))
    .join("<br/>");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Invoice ${escapeHtml(payment.orderId)}</title>
  <style>
    body { font-family: Georgia, serif; color: #1b2a4a; max-width: 720px; margin: 40px auto; padding: 0 20px; }
    h1 { font-size: 1.6rem; margin: 0 0 4px; }
    .muted { color: #5a6a85; font-size: 0.92rem; }
    .card { border: 1px solid #d7e0ec; border-radius: 12px; padding: 20px; margin-top: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { text-align: left; padding: 10px 0; border-bottom: 1px solid #eef2f7; }
    .total { font-size: 1.15rem; font-weight: 700; }
    .actions { margin-top: 24px; display: flex; gap: 10px; }
    button, a.btn { background: #2b6cb0; color: #fff; border: 0; border-radius: 8px; padding: 10px 14px; text-decoration: none; font: inherit; cursor: pointer; }
    @media print { .actions { display: none; } body { margin: 0; } }
  </style>
</head>
<body>
  <h1>CVScholar Invoice</h1>
  <p class="muted">Order ${escapeHtml(payment.orderId)} · Paid ${escapeHtml(paidAt)}</p>
  <div class="card">
    <strong>Bill to</strong>
    <p>${billTo || escapeHtml(session.user.email || "")}</p>
    <table>
      <thead><tr><th>Description</th><th>Amount</th></tr></thead>
      <tbody>
        <tr><td>${escapeHtml(planName)}</td><td>${escapeHtml(payment.currency)} ${escapeHtml(amount)}</td></tr>
      </tbody>
    </table>
    <p class="total">Total paid: ${escapeHtml(payment.currency)} ${escapeHtml(amount)}</p>
    <p class="muted">Payment ID: ${escapeHtml(payment.payherePaymentId || "—")}</p>
  </div>
  <div class="actions">
    <button type="button" onclick="window.print()">Print / Save as PDF</button>
    <a class="btn" href="/billing">Back to Billing</a>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store"
    }
  });
}
