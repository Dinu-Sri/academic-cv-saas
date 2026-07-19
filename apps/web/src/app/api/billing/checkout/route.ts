import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { startCheckoutForUser } from "@/lib/billing/service";

const bodySchema = z.object({
  planKey: z.enum(["pdf_pass", "scholar_annual"])
});

function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.BETTER_AUTH_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Please login first." }, { status: 401 });
  }

  try {
    const body = bodySchema.parse(await request.json());
    const result = await startCheckoutForUser(session.user, body.planKey, appBaseUrl());

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid checkout request." }, { status: 400 });
    }
    console.error("[billing/checkout]", error);
    return NextResponse.json({ error: "Checkout failed." }, { status: 500 });
  }
}
