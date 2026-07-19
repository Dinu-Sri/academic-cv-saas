import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getBillingStatusForUser, simulateCompleteCheckout } from "@/lib/billing/service";

const bodySchema = z.object({
  orderId: z.string().min(4)
});

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Please login first." }, { status: 401 });
  }

  try {
    const body = bodySchema.parse(await request.json());
    const result = await simulateCompleteCheckout(session.user, body.orderId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const billing = await getBillingStatusForUser(session.user);
    return NextResponse.json({ ok: true, subscription: billing.subscription, recentPayments: billing.recentPayments });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    console.error("[billing/simulate]", error);
    return NextResponse.json({ error: "Simulate failed." }, { status: 500 });
  }
}
