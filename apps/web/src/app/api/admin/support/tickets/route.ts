import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { listTicketsForAdmin } from "@/lib/support/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const gate = await requirePlatformAdmin();
  if (gate.response) return gate.response;

  const url = new URL(request.url);
  const tickets = await listTicketsForAdmin({
    status: url.searchParams.get("status") || undefined,
    type: url.searchParams.get("type") || undefined,
    search: url.searchParams.get("search") || undefined
  });

  return NextResponse.json({ tickets });
}
