import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getOrCreateAgentSession } from "@/lib/cv-agent/context";
import { applyAgentPatches, summarizePatchResults } from "@/lib/cv-agent/patches";
import { prisma } from "@/lib/prisma";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

const confirmSchema = z.object({
  patchLogIds: z.array(z.string().trim().min(1)).min(1).max(10)
});

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Please login before confirming AI changes." }, { status: 401 });
  }

  const payload = confirmSchema.parse(await request.json());
  const { workspace, profile } = await getOrCreateWorkspaceForUser(session.user);
  const agentSession = await getOrCreateAgentSession(workspace.id, profile.id);
  const patchLogs = await prisma.cvAgentPatchLog.findMany({
    where: {
      id: { in: payload.patchLogIds },
      workspaceId: workspace.id,
      profileId: profile.id,
      sessionId: agentSession.id,
      status: { in: ["needs_confirmation", "conflict"] }
    }
  });

  if (patchLogs.length === 0) {
    return NextResponse.json({ error: "No pending AI changes were found." }, { status: 404 });
  }

  const patchResult = await applyAgentPatches({
    workspaceId: workspace.id,
    profileId: profile.id,
    sessionId: agentSession.id,
    patches: patchLogs.map((log) => log.patchJson),
    confirmed: true
  });
  const patchSummary = summarizePatchResults(patchResult.results);

  await prisma.cvAgentPatchLog.updateMany({
    where: { id: { in: patchLogs.map((log) => log.id) } },
    data: {
      status: "confirmed",
      appliedAt: new Date()
    }
  });

  return NextResponse.json({
    ok: true,
    patchSummary,
    editor: patchResult.editor
  });
}
