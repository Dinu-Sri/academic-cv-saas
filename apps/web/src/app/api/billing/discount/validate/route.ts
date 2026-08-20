import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { previewDiscountCode } from "@/lib/billing/discount-codes";
import { getPaidPlan, isPaidPlanKey } from "@/lib/billing/plans";

const bodySchema = z.object({
  code: z.string().trim().min(1).max(40),
  planKey: z.enum(["pdf_pass", "scholar_annual"])
});

/** Preview a discount code for the checkout modal (does not consume a use). */
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Please login first." }, { status: 401 });
  }

  try {
    const body = bodySchema.parse(await request.json());
    if (!isPaidPlanKey(body.planKey)) {
      return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
    }
    const plan = getPaidPlan(body.planKey);
    if (!plan) {
      return NextResponse.json({ error: "Plan not found." }, { status: 400 });
    }

    const result = await previewDiscountCode({
      code: body.code,
      planKey: body.planKey,
      originalAmount: plan.priceUsd
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, discount: result.discount });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Enter a valid discount code." }, { status: 400 });
    }
    console.error("[billing/discount/validate]", error);
    return NextResponse.json({ error: "Could not validate discount code." }, { status: 500 });
  }
}
