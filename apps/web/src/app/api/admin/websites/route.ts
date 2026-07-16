import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { getWebsiteOpsDashboard, listWebsitesForAdmin } from "@/lib/website/admin-ops";

export async function GET(request: Request) {
  const admin = await requirePlatformAdmin();
  if (admin.response) return admin.response;

  const { searchParams } = new URL(request.url);
  const includeDashboard = searchParams.get("dashboard") !== "0";
  const websites = await listWebsitesForAdmin(50);
  const dashboard = includeDashboard ? await getWebsiteOpsDashboard() : null;

  return NextResponse.json({
    websites,
    dashboard
  });
}
