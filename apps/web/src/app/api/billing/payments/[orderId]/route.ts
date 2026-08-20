import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  cancelBillingPaymentForUser,
  dismissBillingPaymentForUser
} from "@/lib/billing/service";

type Params = { params: Promise<{ orderId: string }> };

const patchSchema = z.object({
  action: z.enum(["cancel", "dismiss"])
});

/**
 * PATCH — cancel (mark cancelled) or dismiss (delete) a non-completed payment.
 */
export async function PATCH(request: Request, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Please login first." }, { status: 401 });
  }

  const { orderId } = await params;
  if (!orderId?.trim()) {
    return NextResponse.json({ error: "Missing order id." }, { status: 400 });
  }

  try {
    const body = patchSchema.parse(await request.json());
    const result =
      body.action === "dismiss"
        ? await dismissBillingPaymentForUser(session.user, orderId)
        : await cancelBillingPaymentForUser(session.user, orderId);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    console.error("[billing/payments]", error);
    return NextResponse.json({ error: "Could not update payment." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Please login first." }, { status: 401 });
  }
  const { orderId } = await params;
  const result = await dismissBillingPaymentForUser(session.user, orderId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
