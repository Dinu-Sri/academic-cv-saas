import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAgentSessionPayload } from "@/lib/cv-agent/service";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Please login before using Build with AI." }, { status: 401 });
  }

  const { workspace, profile } = await getOrCreateWorkspaceForUser(session.user);
  const payload = await getAgentSessionPayload(workspace.id, profile.id);

  return NextResponse.json({ ok: true, ...payload });
}
