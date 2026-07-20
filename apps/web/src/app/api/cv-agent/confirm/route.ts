import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getOrCreateAgentSession } from "@/lib/cv-agent/context";
import { applyAgentPatches, summarizePatchResults, validatePendingProposalFresh } from "@/lib/cv-agent/patches";
import { prisma } from "@/lib/prisma";
import { resolveRequestActor } from "@/lib/request-user";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

const confirmSchema = z.object({
  proposalId: z.string().trim().min(1).optional(),
  patchLogIds: z.array(z.string().trim().min(1)).min(1).max(10)
});

export async function POST(request: Request) {
  const actor = await resolveRequestActor({ allowGuest: true });

  if (!actor) {
    return NextResponse.json({ error: "Please login before confirming AI changes." }, { status: 401 });
  }

  const payload = confirmSchema.parse(await request.json());
  const { workspace, profile } = await getOrCreateWorkspaceForUser(actor.user);
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

  const proposalIds = Array.from(new Set(patchLogs.map((log) => log.proposalId).filter((id): id is string => Boolean(id))));
  const proposalId = payload.proposalId ?? proposalIds[0];
  if (proposalIds.length > 1 || (payload.proposalId && proposalIds.length > 0 && !proposalIds.includes(payload.proposalId))) {
    return NextResponse.json({ error: "This review contains mixed AI proposals. Please refresh and review one proposal at a time." }, { status: 409 });
  }

  if (proposalId) {
    const freshness = await validatePendingProposalFresh({
      workspaceId: workspace.id,
      profileId: profile.id,
      sessionId: agentSession.id,
      proposalId
    });

    if (!freshness.ok) {
      return NextResponse.json({ error: freshness.message }, { status: 409 });
    }
  }

  const patchResult = await applyAgentPatches({
    workspaceId: workspace.id,
    profileId: profile.id,
    sessionId: agentSession.id,
    patches: patchLogs.map((log) => log.patchJson),
    confirmed: true,
    proposalId
  });
  const patchSummary = summarizePatchResults(patchResult.results);

  await prisma.$transaction([
    prisma.cvAgentPatchLog.updateMany({
      where: { id: { in: patchLogs.map((log) => log.id) } },
      data: {
        status: "confirmed",
        appliedAt: new Date()
      }
    }),
    ...(proposalId
      ? [
          prisma.agentApproval.create({
            data: {
              workspaceId: workspace.id,
              profileId: profile.id,
              sessionId: agentSession.id,
              proposalId,
              decision: "approved",
              decidedBy: actor.user.id
            }
          })
        ]
      : [])
  ]);

  return NextResponse.json({
    ok: true,
    patchSummary,
    editor: patchResult.editor
  });
}
