import { resolveRequestActor } from "@/lib/request-user";
import { NextResponse } from "next/server";
import { websitePublishEnabled } from "@/lib/website/constants";
import { requestWebsitePublishForUser } from "@/lib/website/publish-service";
import { getWebsiteWorkspaceForUser } from "@/lib/website/service";

export async function POST() {
  if (!websitePublishEnabled()) {
    return NextResponse.json({ error: "Website publishing is disabled." }, { status: 503 });
  }

  const actor = await resolveRequestActor({ allowGuest: false });
  if (!actor) {
    return NextResponse.json({ error: "Please login first." }, { status: 401 });
  }

  try {
    const result = await requestWebsitePublishForUser(actor.user);
    const workspace = await getWebsiteWorkspaceForUser(actor.user);
    return NextResponse.json({ ok: true, ...result, workspace });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) || 400 : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Publish failed." }, { status });
  }
}
