import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getOrCreateAgentSession } from "@/lib/cv-agent/context";
import { getPendingAgentApproval } from "@/lib/cv-agent/service";
import { prisma } from "@/lib/prisma";
import { resolveRequestActor } from "@/lib/request-user";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

const declineSchema = z.object({
  proposalId: z.string().trim().min(1).optional(),
  patchLogIds: z.array(z.string().trim().min(1)).min(1).max(10)
});

export async function POST(request: Request) {
  const actor = await resolveRequestActor({ allowGuest: true });

  if (!actor) {
    return NextResponse.json({ error: "Please login before declining AI changes." }, { status: 401 });
  }

  const payload = declineSchema.parse(await request.json());
  const { workspace, profile } = await getOrCreateWorkspaceForUser(actor.user);
  const agentSession = await getOrCreateAgentSession(workspace.id, profile.id);
  const patchLogs = await prisma.cvAgentPatchLog.findMany({
    where: {
      id: { in: payload.patchLogIds },
      workspaceId: workspace.id,
      profileId: profile.id,
      sessionId: agentSession.id,
      status: { in: ["needs_confirmation", "conflict"] },
      requiresConfirmation: true
    },
    select: { id: true, proposalId: true }
  });
  const proposalIds = Array.from(new Set(patchLogs.map((log) => log.proposalId).filter((id): id is string => Boolean(id))));
  const proposalId = payload.proposalId ?? proposalIds[0];

  await prisma.$transaction([
    prisma.cvAgentPatchLog.updateMany({
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
    }),
    ...(proposalId
      ? [
          prisma.agentProposal.updateMany({
            where: {
              id: proposalId,
              workspaceId: workspace.id,
              profileId: profile.id,
              sessionId: agentSession.id,
              status: "pending"
            },
            data: {
              status: "declined",
              decidedAt: new Date()
            }
          }),
          prisma.agentProposalChange.updateMany({
            where: { proposalId, status: "pending" },
            data: { status: "declined" }
          }),
          prisma.agentApproval.create({
            data: {
              workspaceId: workspace.id,
              profileId: profile.id,
              sessionId: agentSession.id,
              proposalId,
              decision: "declined",
              decidedBy: actor.user.id
            }
          })
        ]
      : [])
  ]);

  return NextResponse.json({
    ok: true,
    pendingApproval: await getPendingAgentApproval(agentSession.id, workspace.id, profile.id)
  });
}
