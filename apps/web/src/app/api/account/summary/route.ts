import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAccountSummaryForUser } from "@/lib/billing/account-summary";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Please login first." }, { status: 401 });
  }

  const summary = await getAccountSummaryForUser(session.user);
  return NextResponse.json(summary);
}
