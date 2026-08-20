import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildInvoiceDocumentHtml } from "@/lib/billing/invoice-document";
import { getBillingPaymentForUserInvoice } from "@/lib/billing/service";
import { absoluteUrl } from "@/lib/content/site-url";

/**
 * Printable A4 corporate invoice for a completed payment (Print / Save as PDF).
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

  const gateway =
    payment.gatewayResponse && typeof payment.gatewayResponse === "object"
      ? (payment.gatewayResponse as Record<string, unknown>)
      : {};
  const complimentary =
    gateway.source === "admin_grant" ||
    gateway.complimentary === true ||
    (Number(payment.amount) === 0 && !payment.discountCode);

  const html = buildInvoiceDocumentHtml({
    orderId: payment.orderId,
    planKey: payment.planKey,
    amount: Number(payment.amount),
    currency: payment.currency,
    status: payment.status,
    paidAt: payment.updatedAt,
    billTo: {
      name: payment.invoiceName || session.user.name || "",
      email: payment.invoiceEmail || session.user.email || "",
      phone: payment.invoicePhone,
      address: payment.invoiceAddress,
      city: payment.invoiceCity,
      country: payment.invoiceCountry
    },
    payherePaymentId: payment.payherePaymentId,
    discountCode: payment.discountCode,
    discountAmount: payment.discountAmount != null ? Number(payment.discountAmount) : null,
    originalAmount: payment.originalAmount != null ? Number(payment.originalAmount) : null,
    complimentary,
    complimentaryNote:
      typeof gateway.note === "string" && gateway.note.trim()
        ? gateway.note.trim()
        : complimentary
          ? "Awarded by the company free of charge."
          : null,
    logoAbsoluteUrl: absoluteUrl("/cvscholar-logo.svg"),
    showActions: true
  });

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store"
    }
  });
}
