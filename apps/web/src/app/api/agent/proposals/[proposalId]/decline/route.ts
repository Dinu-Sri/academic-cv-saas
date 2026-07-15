import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { appendAgentEvent, checkpointAgentNode, finishAgentRun } from "@/lib/agent/events";
import { estimateAgentTokens } from "@/lib/agent/task-thread";
import { getPendingAgentApproval } from "@/lib/cv-agent/service";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

export async function POST(_request: Request, context: { params: Promise<{ proposalId: string }> }) {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Please login before declining AI changes." }, { status: 401 });
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
        }
      }
    }
  });

  if (!proposal) {
    return NextResponse.json({ error: "No pending AI proposal was found." }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.cvAgentPatchLog.updateMany({
      where: {
        proposalId,
        workspaceId: workspace.id,
        profileId: profile.id,
        sessionId: proposal.sessionId,
        status: { in: ["needs_confirmation", "conflict"] },
        requiresConfirmation: true
      },
      data: { status: "declined" }
    }),
    prisma.agentProposal.update({
      where: { id: proposalId },
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
        sessionId: proposal.sessionId,
        taskId: proposal.taskId,
        threadId: proposal.threadId,
        proposalId,
        decision: "declined",
        decidedBy: session.user.id
      }
    })
  ]);

  await resumePausedRunAfterDecline({
    workspaceId: workspace.id,
    profileId: profile.id,
    sessionId: proposal.sessionId,
    taskId: proposal.taskId ?? undefined,
    threadId: proposal.threadId ?? undefined,
    proposalId
  });

  return NextResponse.json({
    ok: true,
    pendingApproval: await getPendingAgentApproval(proposal.sessionId, workspace.id, profile.id)
  });
}

async function resumePausedRunAfterDecline({
  workspaceId,
  profileId,
  sessionId,
  taskId,
  threadId,
  proposalId
}: {
  workspaceId: string;
  profileId: string;
  sessionId: string;
  taskId?: string;
  threadId?: string;
  proposalId: string;
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

  const content = "No problem. I did not change your CV. Tell me what you would like to adjust instead.";
  await prisma.cvAgentMessage.create({
    data: {
      sessionId,
      taskId,
      threadId,
      role: "assistant",
      content,
      tokenEstimate: estimateAgentTokens(content),
      attachmentsJson: [],
      patchSummaryJson: {}
    }
  });

  const identity = { workspaceId, profileId, sessionId, taskId, threadId, runId: run.id };
  await appendAgentEvent(identity, {
    type: "resume_received",
    status: "running",
    message: "Decline decision received.",
    payload: { decision: "declined", proposalId }
  });
  await checkpointAgentNode(identity, "execute_approved_action", { decision: "declined", proposalId });
  await appendAgentEvent(identity, {
    type: "final_response",
    status: "completed",
    message: "Declined CV update recorded.",
    payload: { decision: "declined", proposalId }
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
