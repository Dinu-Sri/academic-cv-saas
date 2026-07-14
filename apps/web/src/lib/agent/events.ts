import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type AgentRunIdentity = {
  workspaceId: string;
  profileId: string;
  sessionId: string;
  runId: string;
};

export async function createAgentRun({
  workspaceId,
  profileId,
  sessionId,
  messageId,
  intent
}: {
  workspaceId: string;
  profileId: string;
  sessionId: string;
  messageId?: string;
  intent: string;
}) {
  return prisma.agentRun.create({
    data: {
      workspaceId,
      profileId,
      sessionId,
      messageId,
      intent,
      status: "running",
      mode: "transitional",
      startedAt: new Date()
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
