import { resolveRequestActor } from "@/lib/request-user";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { websiteFeatureEnabled } from "@/lib/website/constants";
import { getWebsiteWorkspaceForUser } from "@/lib/website/service";

export async function GET() {
  if (!websiteFeatureEnabled()) {
    return NextResponse.json({ error: "Website feature is disabled." }, { status: 503 });
  }

  const actor = await resolveRequestActor({ allowGuest: true });
  if (!actor) {
    return NextResponse.json({ error: "Please login first." }, { status: 401 });
  }

  const payload = await getWebsiteWorkspaceForUser(actor.user);
  if (!payload.enabled) {
    return NextResponse.json({ error: payload.reason }, { status: 503 });
  }

  return NextResponse.json({ readiness: payload.readiness, profile: payload.profile });
}
