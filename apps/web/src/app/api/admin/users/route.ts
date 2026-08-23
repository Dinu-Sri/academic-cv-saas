import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { listAdminUsers } from "@/lib/admin-users";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const gate = await requirePlatformAdmin();
  if (gate.response) return gate.response;

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") || "1") || 1;
  const search = url.searchParams.get("search") || "";
  const pageSize = Number(url.searchParams.get("pageSize") || "10") || 10;
  const includeGuests =
    url.searchParams.get("includeGuests") === "1" ||
    url.searchParams.get("includeGuests") === "true";

  const result = await listAdminUsers({ page, search, pageSize, includeGuests });
  return NextResponse.json(result);
}
