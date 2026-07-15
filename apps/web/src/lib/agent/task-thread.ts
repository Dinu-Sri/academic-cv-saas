import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type AgentTaskThread = {
  taskId: string;
  threadId: string;
  chapterNumber: number;
};

const DEFAULT_RECENT_MESSAGE_WINDOW = 16;
const DEFAULT_CONTEXT_TOKEN_LIMIT = 6000;
const DEFAULT_THREAD_MESSAGE_LIMIT = 80;
const DEFAULT_ROLLOVER_COMPACTIONS = 3;

export function estimateAgentTokens(value: string) {
  return Math.max(1, Math.ceil(value.trim().length / 4));
}

export async function ensureAgentTaskThread({
  workspaceId,
  profileId,
  sessionId,
  title = "Build with AI"
}: {
  workspaceId: string;
  profileId: string;
  sessionId: string;
  title?: string;
}): Promise<AgentTaskThread> {
  const session = await prisma.cvAgentSession.findUniqueOrThrow({ where: { id: sessionId } });

  if (session.activeTaskId && session.activeThreadId) {
    const activeThread = await prisma.agentThread.findFirst({
      where: {
        id: session.activeThreadId,
        taskId: session.activeTaskId,
        status: "active"
      },
      select: { id: true, taskId: true, chapterNumber: true }
    });

    if (activeThread) {
      return {
        taskId: activeThread.taskId,
        threadId: activeThread.id,
        chapterNumber: activeThread.chapterNumber
      };
    }
  }

  const existingTask = await prisma.agentTask.findFirst({
    where: {
      workspaceId,
      profileId,
      sessionId,
      status: "active"
    },
    orderBy: { updatedAt: "desc" }
  });
  const task =
    existingTask ??
    (await prisma.agentTask.create({
      data: {
        workspaceId,
        profileId,
        sessionId,
        title: title || "Build my academic CV",
        status: "active"
      }
    }));

  const existingThread = await prisma.agentThread.findFirst({
    where: {
      workspaceId,
      profileId,
      sessionId,
      taskId: task.id,
      status: "active"
    },
    orderBy: { chapterNumber: "desc" }
  });
  const thread =
    existingThread ??
    (await prisma.agentThread.create({
      data: {
        workspaceId,
        profileId,
        sessionId,
        taskId: task.id,
        chapterNumber: 1,
        title: "Chapter 1",
        status: "active"
      }
    }));

  await Promise.all([
    prisma.cvAgentSession.update({
      where: { id: sessionId },
      data: {
        activeTaskId: task.id,
        activeThreadId: thread.id
      }
    }),
    prisma.agentTask.update({
      where: { id: task.id },
      data: {
        activeThreadId: thread.id
      }
    })
  ]);

  return {
    taskId: task.id,
    threadId: thread.id,
    chapterNumber: thread.chapterNumber
  };
}

export async function compactOrRolloverThread({
  workspaceId,
  profileId,
  sessionId,
  taskId,
  threadId
}: {
  workspaceId: string;
  profileId: string;
  sessionId: string;
  taskId: string;
  threadId: string;
}) {
  const recentWindow = envInt("CVSCHOLAR_AGENT_RECENT_MESSAGE_WINDOW", DEFAULT_RECENT_MESSAGE_WINDOW);
  const tokenLimit = envInt("CVSCHOLAR_AGENT_CONTEXT_TOKEN_LIMIT", DEFAULT_CONTEXT_TOKEN_LIMIT);
  const threadMessageLimit = envInt("CVSCHOLAR_AGENT_THREAD_MESSAGE_LIMIT", DEFAULT_THREAD_MESSAGE_LIMIT);
  const rolloverCompactions = envInt("CVSCHOLAR_AGENT_ROLLOVER_COMPACTIONS", DEFAULT_ROLLOVER_COMPACTIONS);

  const messages = await prisma.cvAgentMessage.findMany({
    where: { threadId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      content: true,
      tokenEstimate: true,
      compactedAt: true,
      createdAt: true
    }
  });
  const estimatedTokens = messages.reduce((total, message) => total + (message.tokenEstimate || estimateAgentTokens(message.content)), 0);

  await prisma.agentThread.update({
    where: { id: threadId },
    data: {
      tokenEstimate: estimatedTokens,
      messageCount: messages.length,
      lastMessageAt: messages.at(-1)?.createdAt
    }
  });

  if (messages.length <= recentWindow || estimatedTokens < tokenLimit) {
    return { threadId, rolledOver: false };
  }

  const compactable = messages.slice(0, Math.max(0, messages.length - recentWindow)).filter((message) => !message.compactedAt);
  if (compactable.length > 0) {
    const summaryPayload = await buildThreadSummaryPayload(taskId, threadId, compactable);
    const summary = await prisma.agentThreadSummary.create({
      data: {
        workspaceId,
        profileId,
        taskId,
        threadId,
        coveredMessageStartId: compactable[0]?.id ?? "",
        coveredMessageEndId: compactable.at(-1)?.id ?? "",
        coveredMessageCount: compactable.length,
        tokenEstimate: compactable.reduce((total, message) => total + (message.tokenEstimate || estimateAgentTokens(message.content)), 0),
        summaryJson: summaryPayload.summaryJson as Prisma.InputJsonValue,
        decisionsJson: summaryPayload.decisionsJson as Prisma.InputJsonValue,
        pendingQuestionsJson: summaryPayload.pendingQuestionsJson as Prisma.InputJsonValue,
        proposalIdsJson: summaryPayload.proposalIdsJson as Prisma.InputJsonValue,
        entityRefsJson: summaryPayload.entityRefsJson as Prisma.InputJsonValue
      }
    });

    await prisma.cvAgentMessage.updateMany({
      where: { id: { in: compactable.map((message) => message.id) } },
      data: {
        compactedAt: new Date(),
        summaryBoundary: summary.id
      }
    });

    await prisma.agentThread.update({
      where: { id: threadId },
      data: {
        compactionCount: { increment: 1 }
      }
    });
  }

  const refreshedThread = await prisma.agentThread.findUniqueOrThrow({
    where: { id: threadId },
    select: { compactionCount: true, chapterNumber: true }
  });
  const shouldRollover = refreshedThread.compactionCount >= rolloverCompactions || messages.length >= threadMessageLimit;
  if (!shouldRollover) {
    return { threadId, rolledOver: false };
  }

  const newThread = await prisma.agentThread.create({
    data: {
      workspaceId,
      profileId,
      sessionId,
      taskId,
      chapterNumber: refreshedThread.chapterNumber + 1,
      title: `Chapter ${refreshedThread.chapterNumber + 1}`,
      status: "active",
      rolloverReason: messages.length >= threadMessageLimit ? "message_limit" : "compaction_limit",
      stateJson: {
        previousThreadId: threadId,
        carriedSummaryCount: await prisma.agentThreadSummary.count({ where: { threadId } })
      } as Prisma.InputJsonValue
    }
  });

  await Promise.all([
    prisma.agentThread.update({
      where: { id: threadId },
      data: { status: "rolled_over" }
    }),
    prisma.agentTask.update({
      where: { id: taskId },
      data: { activeThreadId: newThread.id }
    }),
    prisma.cvAgentSession.update({
      where: { id: sessionId },
      data: { activeThreadId: newThread.id }
    })
  ]);

  return { threadId: newThread.id, rolledOver: true };
}

async function buildThreadSummaryPayload(
  taskId: string,
  threadId: string,
  messages: { role: string; content: string }[]
) {
  const [pendingProposals, approvals] = await Promise.all([
    prisma.agentProposal.findMany({
      where: { taskId, status: "pending" },
      select: { id: true, title: true, summary: true }
    }),
    prisma.agentApproval.findMany({
      where: { threadId },
      orderBy: { createdAt: "asc" },
      select: { proposalId: true, decision: true, reason: true }
    })
  ]);

  return {
    summaryJson: {
      kind: "deterministic_thread_summary",
      messageCount: messages.length,
      recentTopics: extractTopicHints(messages)
    },
    decisionsJson: approvals.map((approval) => ({
      proposalId: approval.proposalId,
      decision: approval.decision,
      reason: approval.reason
    })),
    pendingQuestionsJson: [],
    proposalIdsJson: pendingProposals.map((proposal) => proposal.id),
    entityRefsJson: pendingProposals.map((proposal) => ({
      proposalId: proposal.id,
      title: proposal.title,
      summary: proposal.summary
    }))
  };
}

function extractTopicHints(messages: { role: string; content: string }[]) {
  return messages
    .slice(-8)
    .map((message) => `${message.role}: ${message.content.replace(/\s+/g, " ").trim()}`)
    .filter(Boolean)
    .map((line) => (line.length > 220 ? `${line.slice(0, 217)}...` : line));
}

function envInt(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
