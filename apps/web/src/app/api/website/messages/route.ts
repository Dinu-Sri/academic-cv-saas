import { NextResponse } from "next/server";
import { resolveRequestActor } from "@/lib/request-user";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";
import { listWebsiteMessagesForOwner } from "@/lib/website/contact-service";

export async function GET() {
  const actor = await resolveRequestActor({ allowGuest: false });
  if (!actor) {
    return NextResponse.json({ error: "Please login first." }, { status: 401 });
  }

  const { workspace, profile } = await getOrCreateWorkspaceForUser(actor.user);
  const messages = await listWebsiteMessagesForOwner(workspace.id, profile.id);
  return NextResponse.json({ messages });
}
