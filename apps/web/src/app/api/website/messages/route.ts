import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";
import { listWebsiteMessagesForOwner } from "@/lib/website/contact-service";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Please login first." }, { status: 401 });
  }

  const { workspace, profile } = await getOrCreateWorkspaceForUser(session.user);
  const messages = await listWebsiteMessagesForOwner(workspace.id, profile.id);
  return NextResponse.json({ messages });
}
