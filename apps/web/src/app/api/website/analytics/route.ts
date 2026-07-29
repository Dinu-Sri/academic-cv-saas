import { NextResponse } from "next/server";
import { resolveRequestActor } from "@/lib/request-user";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";
import { prisma } from "@/lib/prisma";
import { getWebsiteAnalyticsSummary } from "@/lib/website/analytics";

const ALLOWED_RANGES = new Set([7, 14, 30, 90]);

export async function GET(request: Request) {
  const actor = await resolveRequestActor({ allowGuest: false });
  if (!actor) {
    return NextResponse.json({ error: "Please login first." }, { status: 401 });
  }

  const { workspace, profile } = await getOrCreateWorkspaceForUser(actor.user);
  const website = await prisma.academicWebsite.findFirst({
    where: { workspaceId: workspace.id, profileId: profile.id }
  });
  const requestedDays = Number(new URL(request.url).searchParams.get("days") || 30);
  const days = ALLOWED_RANGES.has(requestedDays) ? requestedDays : 30;
  if (!website) {
    return NextResponse.json({ analytics: { totalViews: 0, days, pages: [], series: [] } });
  }

  const analytics = await getWebsiteAnalyticsSummary(website.id, days);
  return NextResponse.json({ analytics });
}
