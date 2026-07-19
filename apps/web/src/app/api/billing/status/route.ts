import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBillingStatusForUser, getPaymentStatusForUser } from "@/lib/billing/service";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Please login first." }, { status: 401 });
  }

  const orderId = new URL(request.url).searchParams.get("order_id")?.trim() || "";
  if (!orderId) {
    return NextResponse.json({ error: "order_id is required." }, { status: 400 });
  }

  const payment = await getPaymentStatusForUser(session.user, orderId);
  if (!payment) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }

  const billing = await getBillingStatusForUser(session.user);
  return NextResponse.json({ payment, subscription: billing.subscription });
}
