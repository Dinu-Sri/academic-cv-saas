import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";
import { prisma } from "@/lib/prisma";
import { getWebsiteAnalyticsSummary } from "@/lib/website/analytics";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Please login first." }, { status: 401 });
  }

  const { workspace, profile } = await getOrCreateWorkspaceForUser(session.user);
  const website = await prisma.academicWebsite.findFirst({
    where: { workspaceId: workspace.id, profileId: profile.id }
  });
  if (!website) {
    return NextResponse.json({ analytics: { totalViews: 0, days: 14, pages: [], series: [] } });
  }

  const analytics = await getWebsiteAnalyticsSummary(website.id, 14);
  return NextResponse.json({ analytics });
}
