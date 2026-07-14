import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAgentSessionPayload } from "@/lib/cv-agent/service";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

export async function GET(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Please login before using Build with AI." }, { status: 401 });
  }

  const { workspace, profile } = await getOrCreateWorkspaceForUser(session.user);
  const url = new URL(request.url);
  const beforeParam = url.searchParams.get("before");
  const before = beforeParam ? new Date(beforeParam) : undefined;
  const limit = Number.parseInt(url.searchParams.get("limit") || "80", 10);
  const payload = await getAgentSessionPayload(workspace.id, profile.id, {
    before: before && Number.isFinite(before.getTime()) ? before : undefined,
    limit
  });

  return NextResponse.json({ ok: true, ...payload });
}
