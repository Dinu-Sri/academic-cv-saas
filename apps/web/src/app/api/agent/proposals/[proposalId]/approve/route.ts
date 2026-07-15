import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { appendAgentEvent, checkpointAgentNode, finishAgentRun } from "@/lib/agent/events";
import { applyAgentPatches, summarizePatchResults, validatePendingProposalFresh } from "@/lib/cv-agent/patches";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

export async function POST(_request: Request, context: { params: Promise<{ proposalId: string }> }) {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Please login before approving AI changes." }, { status: 401 });
  }

  const { proposalId } = await context.params;
  const { workspace, profile } = await getOrCreateWorkspaceForUser(session.user);
  const proposal = await prisma.agentProposal.findFirst({
    where: {
      id: proposalId,
      workspaceId: workspace.id,
      profileId: profile.id,
      status: "pending"
    },
    include: {
      patchLogs: {
        where: {
          status: { in: ["needs_confirmation", "conflict"] },
          requiresConfirmation: true
        },
        orderBy: { createdAt: "asc" }
      }
    }
  });

  if (!proposal || proposal.patchLogs.length === 0) {
    return NextResponse.json({ error: "No pending AI proposal was found." }, { status: 404 });
  }

  const freshness = await validatePendingProposalFresh({
    workspaceId: workspace.id,
    profileId: profile.id,
    sessionId: proposal.sessionId,
    proposalId
  });

  if (!freshness.ok) {
    return NextResponse.json({ error: freshness.message }, { status: 409 });
  }

  const patchResult = await applyAgentPatches({
    workspaceId: workspace.id,
    profileId: profile.id,
    sessionId: proposal.sessionId,
    taskId: proposal.taskId ?? undefined,
    threadId: proposal.threadId ?? undefined,
    patches: proposal.patchLogs.map((log) => log.patchJson),
    confirmed: true,
    proposalId
  });
  const patchSummary = summarizePatchResults(patchResult.results);

  await prisma.$transaction([
    prisma.cvAgentPatchLog.updateMany({
      where: { id: { in: proposal.patchLogs.map((log) => log.id) } },
      data: {
        status: "confirmed",
        appliedAt: new Date()
      }
    }),
    prisma.agentApproval.create({
      data: {
        workspaceId: workspace.id,
        profileId: profile.id,
        sessionId: proposal.sessionId,
        taskId: proposal.taskId,
        threadId: proposal.threadId,
        proposalId,
        decision: "approved",
        decidedBy: session.user.id
      }
    })
  ]);

  await resumePausedRunAfterDecision({
    workspaceId: workspace.id,
    profileId: profile.id,
    sessionId: proposal.sessionId,
    taskId: proposal.taskId ?? undefined,
    threadId: proposal.threadId ?? undefined,
    decision: "approved",
    proposalId,
    patchSummary: JSON.parse(JSON.stringify(patchSummary)) as Prisma.InputJsonValue
  });

  return NextResponse.json({
    ok: true,
    patchSummary,
    editor: patchResult.editor
  });
}

async function resumePausedRunAfterDecision({
  workspaceId,
  profileId,
  sessionId,
  taskId,
  threadId,
  decision,
  proposalId,
  patchSummary
}: {
  workspaceId: string;
  profileId: string;
  sessionId: string;
  taskId?: string;
  threadId?: string;
  decision: string;
  proposalId: string;
  patchSummary: Prisma.InputJsonValue;
}) {
  const run = await prisma.agentRun.findFirst({
    where: {
      workspaceId,
      profileId,
      sessionId,
      taskId,
      threadId,
      status: "paused",
      resumeStatus: "awaiting_approval"
    },
    orderBy: { createdAt: "desc" }
  });

  if (!run) return;

  const identity = { workspaceId, profileId, sessionId, taskId, threadId, runId: run.id };
  await appendAgentEvent(identity, {
    type: "resume_received",
    status: "running",
    message: "Approval decision received.",
    payload: { decision, proposalId }
  });
  await checkpointAgentNode(identity, "execute_approved_action", { decision, proposalId });
  await checkpointAgentNode(identity, "validate_result", { patchSummary });
  await appendAgentEvent(identity, {
    type: "final_response",
    status: "completed",
    message: "Approved CV update applied.",
    payload: { decision, proposalId }
  });
  await finishAgentRun(run.id, {
    provider: run.provider,
    model: run.model,
    inputTokens: run.inputTokens,
    outputTokens: run.outputTokens,
    estimatedCostCents: run.estimatedCostCents,
    latencyMs: run.latencyMs
  });
}
