import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type AgentRunIdentity = {
  workspaceId: string;
  profileId: string;
  sessionId: string;
  taskId?: string;
  threadId?: string;
  runId: string;
};

export async function createAgentRun({
  workspaceId,
  profileId,
  sessionId,
  taskId,
  threadId,
  messageId,
  intent,
  mode = "transitional",
  status = "running",
  deadlineAt
}: {
  workspaceId: string;
  profileId: string;
  sessionId: string;
  taskId?: string;
  threadId?: string;
  messageId?: string;
  intent: string;
  mode?: string;
  status?: string;
  deadlineAt?: Date;
}) {
  return prisma.agentRun.create({
    data: {
      workspaceId,
      profileId,
      sessionId,
      taskId,
      threadId,
      messageId,
      intent,
      status,
      mode,
      deadlineAt,
      startedAt: status === "queued" ? null : new Date()
    }
  });
}

export async function appendAgentEvent(
  identity: AgentRunIdentity,
  event: {
    type: string;
    status?: string;
    message?: string;
    payload?: Prisma.InputJsonValue;
  }
) {
  const last = await prisma.agentEvent.findFirst({
    where: { runId: identity.runId },
    orderBy: { sequence: "desc" },
    select: { sequence: true }
  });

  return prisma.agentEvent.create({
    data: {
      workspaceId: identity.workspaceId,
      profileId: identity.profileId,
      runId: identity.runId,
      sequence: (last?.sequence ?? 0) + 1,
      type: event.type,
      status: event.status ?? "info",
      message: event.message ?? "",
      payloadJson: event.payload ?? {}
    }
  });
}

export async function finishAgentRun(
  runId: string,
  data: {
    provider?: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    estimatedCostCents?: number;
    latencyMs?: number;
  } = {}
) {
  return prisma.agentRun.update({
    where: { id: runId },
    data: {
      status: "completed",
      finishedAt: new Date(),
      ...data
    }
  });
}

export async function failAgentRun(runId: string, error: string) {
  return prisma.agentRun.update({
    where: { id: runId },
    data: {
      status: "failed",
      error,
      finishedAt: new Date()
    }
  });
}

export async function checkpointAgentNode(
  identity: AgentRunIdentity,
  nodeName: string,
  state: Prisma.InputJsonValue,
  status = "completed"
) {
  const checkpointKey = `${identity.runId}:${nodeName}`;
  await prisma.agentRun.update({
    where: { id: identity.runId },
    data: {
      currentNode: nodeName
    }
  });

  return prisma.agentGraphCheckpoint.upsert({
    where: { checkpointKey },
    update: {
      status,
      stateJson: state
    },
    create: {
      workspaceId: identity.workspaceId,
      profileId: identity.profileId,
      runId: identity.runId,
      taskId: identity.taskId,
      threadId: identity.threadId,
      checkpointKey,
      nodeName,
      status,
      stateJson: state
    }
  });
}
