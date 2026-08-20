import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { startCheckoutForUser } from "@/lib/billing/service";

const bodySchema = z.object({
  planKey: z.enum(["pdf_pass", "scholar_annual"]),
  discountCode: z.string().trim().max(40).optional().default(""),
  invoice: z.object({
    name: z.string().trim().min(1).max(160),
    email: z.string().trim().email().max(320),
    phone: z.string().trim().max(40).optional().default(""),
    address: z.string().trim().min(1).max(240),
    city: z.string().trim().min(1).max(120),
    country: z.string().trim().min(1).max(120)
  })
});

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Please login first." }, { status: 401 });
  }

  try {
    const body = bodySchema.parse(await request.json());
    const result = await startCheckoutForUser(
      session.user,
      body.planKey,
      body.invoice,
      body.discountCode || null
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Please complete all required billing details for your invoice." },
        { status: 400 }
      );
    }
    console.error("[billing/checkout]", error);
    return NextResponse.json({ error: "Checkout failed." }, { status: 500 });
  }
}
