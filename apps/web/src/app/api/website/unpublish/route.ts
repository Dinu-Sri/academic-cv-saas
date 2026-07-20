import { resolveRequestActor } from "@/lib/request-user";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { unpublishWebsiteForUser } from "@/lib/website/publish-service";
import { getWebsiteWorkspaceForUser } from "@/lib/website/service";

export async function POST() {
  const actor = await resolveRequestActor({ allowGuest: true });
  if (!actor) {
    return NextResponse.json({ error: "Please login first." }, { status: 401 });
  }

  try {
    await unpublishWebsiteForUser(actor.user);
    const workspace = await getWebsiteWorkspaceForUser(actor.user);
    return NextResponse.json({ ok: true, workspace });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) || 400 : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unpublish failed." }, { status });
  }
}
