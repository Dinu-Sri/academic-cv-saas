import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isPlatformAdmin } from "@/lib/admin";
import { auth } from "@/lib/auth";
import {
  createDiscountCode,
  listDiscountCodesForAdmin
} from "@/lib/billing/discount-codes";

const createSchema = z.object({
  code: z.string().trim().min(3).max(40),
  discountType: z.enum(["percent", "fixed"]),
  value: z.number().positive().max(100000),
  planKey: z.enum(["", "pdf_pass", "scholar_annual"]).optional().default(""),
  maxUses: z.number().int().positive().nullable().optional(),
  expiresAt: z.string().min(1).nullable().optional(),
  note: z.string().trim().max(500).optional().default(""),
  active: z.boolean().optional().default(true)
});

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Please login first." }, { status: 401 });
  }
  if (!isPlatformAdmin(session.user.email)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const discounts = await listDiscountCodesForAdmin();
  return NextResponse.json({ discounts });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Please login first." }, { status: 401 });
  }
  if (!isPlatformAdmin(session.user.email)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  try {
    const body = createSchema.parse(await request.json());
    const result = await createDiscountCode({
      ...body,
      adminEmail: session.user.email || "admin"
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true, discount: result.discount });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid discount code payload." }, { status: 400 });
    }
    console.error("[admin/discount-codes]", error);
    return NextResponse.json({ error: "Could not create discount code." }, { status: 500 });
  }
}
