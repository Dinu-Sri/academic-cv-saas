import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getOrCreateAgentSession } from "@/lib/cv-agent/context";
import { getPendingAgentApproval } from "@/lib/cv-agent/service";
import { prisma } from "@/lib/prisma";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

const declineSchema = z.object({
  patchLogIds: z.array(z.string().trim().min(1)).min(1).max(10)
});

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Please login before declining AI changes." }, { status: 401 });
  }

  const payload = declineSchema.parse(await request.json());
  const { workspace, profile } = await getOrCreateWorkspaceForUser(session.user);
  const agentSession = await getOrCreateAgentSession(workspace.id, profile.id);

  await prisma.cvAgentPatchLog.updateMany({
    where: {
      id: { in: payload.patchLogIds },
      workspaceId: workspace.id,
      profileId: profile.id,
      sessionId: agentSession.id,
      status: { in: ["needs_confirmation", "conflict"] },
      requiresConfirmation: true
    },
    data: {
      status: "declined"
    }
  });

  return NextResponse.json({
    ok: true,
    pendingApproval: await getPendingAgentApproval(agentSession.id, workspace.id, profile.id)
  });
}
