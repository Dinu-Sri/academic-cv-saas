import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isPlatformAdmin } from "@/lib/admin";
import { auth } from "@/lib/auth";
import { updateDiscountCode } from "@/lib/billing/discount-codes";

const patchSchema = z.object({
  active: z.boolean().optional(),
  note: z.string().trim().max(500).optional(),
  maxUses: z.number().int().positive().nullable().optional(),
  expiresAt: z.string().min(1).nullable().optional()
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Please login first." }, { status: 401 });
  }
  if (!isPlatformAdmin(session.user.email)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { id } = await context.params;
  try {
    const body = patchSchema.parse(await request.json());
    const result = await updateDiscountCode(id, body);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true, discount: result.discount });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid update payload." }, { status: 400 });
    }
    console.error("[admin/discount-codes/id]", error);
    return NextResponse.json({ error: "Could not update discount code." }, { status: 500 });
  }
}
