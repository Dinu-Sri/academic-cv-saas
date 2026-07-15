import { NextResponse } from "next/server";
import { getAgentAttachmentExtractionQueue } from "@/lib/agent-attachment-queue";
import { getAgentRunQueue } from "@/lib/agent/queue";
import { allowedToolsForIntent, type AgentIntent, toolPolicies } from "@/lib/agent/policy";
import { adminEmails, requirePlatformAdmin } from "@/lib/admin";
import { getCvImportQueue } from "@/lib/cv-import-queue";
import { getPdfRenderQueue } from "@/lib/pdf-queue";
import { prisma } from "@/lib/prisma";

const agentIntents: AgentIntent[] = [
  "profile_read",
  "profile_update",
  "cv_review",
  "cv_document",
  "attachment_review",
  "pdf_render",
  "general"
];

const featureFlagNames = [
  "CVSCHOLAR_AGENT_RUNS_ENABLED",
  "CVSCHOLAR_AGENT_WORKER_ENABLED",
  "CVSCHOLAR_AGENT_ADVANCED_TOOLS_ENABLED",
  "CVSCHOLAR_AGENT_RETRIEVAL_ENABLED",
  "CVSCHOLAR_AGENT_MEMORY_ENABLED",
  "CVSCHOLAR_AGENT_MAX_TOOL_STEPS",
  "CVSCHOLAR_AGENT_RECENT_MESSAGE_WINDOW",
  "CVSCHOLAR_AGENT_CONTEXT_TOKEN_LIMIT",
  "CVSCHOLAR_AGENT_THREAD_MESSAGE_LIMIT",
  "CVSCHOLAR_AGENT_ROLLOVER_COMPACTIONS"
];

const modelFlagNames = [
  "CVSCHOLAR_AGENT_REASONING_MODEL",
  "CVSCHOLAR_AGENT_WRITING_MODEL",
  "CVSCHOLAR_AGENT_CLASSIFICATION_MODEL",
  "CVSCHOLAR_AGENT_VALIDATION_MODEL",
  "CVSCHOLAR_CV_AGENT_MODEL",
  "CVSCHOLAR_CV_POLISH_MODEL",
  "CVSCHOLAR_DOCUMENT_EXTRACT_MODEL",
  "CVSCHOLAR_PUBLICATION_REVIEW_MODEL"
];

const secretFlagNames = [
  "OPENAI_API_KEY",
  "DEEPSEEK_API_KEY",
  "BETTER_AUTH_SECRET",
  "DATABASE_URL",
  "REDIS_URL",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY"
];

export async function GET() {
  const admin = await requirePlatformAdmin();
  if (admin.response) return admin.response;

  const [
    users,
    runs,
    runStatusGroups,
    proposals,
    memoryItems,
    memoryCandidates,
    knowledgeDocuments,
    knowledgeChunks,
    tasks,
    pdfJobs,
    importJobs,
    workspaces,
    profiles,
    sessions
  ] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        memberships: {
          include: {
            workspace: {
              include: {
                creditWallet: true,
                _count: {
                  select: {
                    profiles: true,
                    agentRuns: true,
                    pdfRenderJobs: true
                  }
                }
              }
            }
          }
        },
        _count: {
          select: {
            sessions: true,
            ownedProfiles: true
          }
        }
      }
    }),
    prisma.agentRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 24,
      include: {
        workspace: { select: { id: true, name: true, slug: true } },
        profile: { select: { id: true, displayName: true, affiliation: true, completeness: true } },
        message: { select: { id: true, role: true, content: true, createdAt: true } },
        events: { orderBy: { sequence: "asc" }, take: 18 },
        toolCalls: { orderBy: { startedAt: "asc" }, take: 12 },
        checkpoints: { orderBy: { createdAt: "asc" }, take: 12 }
      }
    }),
    prisma.agentRun.groupBy({
      by: ["status"],
      _count: { _all: true }
    }),
    prisma.agentProposal.findMany({
      orderBy: { createdAt: "desc" },
      take: 16,
      include: {
        changes: { orderBy: { changeOrder: "asc" }, take: 8 },
        approvals: { orderBy: { createdAt: "desc" }, take: 4 }
      }
    }),
    prisma.agentMemoryItem.findMany({
      orderBy: { updatedAt: "desc" },
      take: 20
    }),
    prisma.agentMemoryCandidate.findMany({
      orderBy: { createdAt: "desc" },
      take: 20
    }),
    prisma.knowledgeDocument.findMany({
      orderBy: [{ namespace: "asc" }, { updatedAt: "desc" }],
      take: 30,
      include: {
        _count: { select: { chunks: true } }
      }
    }),
    prisma.knowledgeChunk.count(),
    prisma.agentTask.findMany({
      orderBy: { updatedAt: "desc" },
      take: 16,
      include: {
        threads: { orderBy: { chapterNumber: "desc" }, take: 3 },
        summaries: { orderBy: { createdAt: "desc" }, take: 2 }
      }
    }),
    prisma.pdfRenderJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 12
    }),
    prisma.cvImportJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 12
    }),
    prisma.workspace.count(),
    prisma.academicProfile.count(),
    prisma.session.count()
  ]);

  const queueHealth = await loadQueueHealth();
  const toolPolicyList = Object.values(toolPolicies);
  const intentMatrix = agentIntents.map((intent) => ({
    intent,
    allowedTools: allowedToolsForIntent(intent)
  }));

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    admin: {
      email: admin.session.user.email,
      configuredAdmins: adminEmails().length
    },
    overview: {
      users: users.length,
      totalWorkspaces: workspaces,
      totalProfiles: profiles,
      activeSessions: sessions,
      agentRuns: runs.length,
      failedRuns: runStatusGroups.find((group) => group.status === "failed")?._count._all ?? 0,
      pendingProposals: proposals.filter((proposal) => proposal.status === "pending").length,
      activeMemories: memoryItems.filter((memory) => memory.status === "active").length,
      pendingMemoryCandidates: memoryCandidates.filter((candidate) => candidate.status === "pending").length,
      knowledgeDocuments: knowledgeDocuments.length,
      knowledgeChunks
    },
    users: users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
      sessions: user._count.sessions,
      profiles: user._count.ownedProfiles,
      workspaces: user.memberships.map((membership) => ({
        id: membership.workspace.id,
        name: membership.workspace.name,
        slug: membership.workspace.slug,
        role: membership.role,
        credits: membership.workspace.creditWallet?.balance ?? 0,
        profileCount: membership.workspace._count.profiles,
        agentRunCount: membership.workspace._count.agentRuns,
        pdfJobCount: membership.workspace._count.pdfRenderJobs
      }))
    })),
    runs: runs.map((run) => ({
      id: run.id,
      workspace: run.workspace,
      profile: run.profile,
      status: run.status,
      mode: run.mode,
      intent: run.intent,
      currentNode: run.currentNode,
      resumeStatus: run.resumeStatus,
      provider: run.provider,
      model: run.model,
      inputTokens: run.inputTokens,
      outputTokens: run.outputTokens,
      estimatedCostCents: run.estimatedCostCents,
      latencyMs: run.latencyMs,
      promptVersion: run.promptVersion,
      toolVersion: run.toolVersion,
      error: run.error,
      createdAt: run.createdAt.toISOString(),
      startedAt: run.startedAt?.toISOString() ?? null,
      finishedAt: run.finishedAt?.toISOString() ?? null,
      message: run.message
        ? {
            id: run.message.id,
            role: run.message.role,
            content: redactAndLimit(run.message.content, 1200),
            createdAt: run.message.createdAt.toISOString()
          }
        : null,
      events: run.events.map((event) => ({
        id: event.id,
        sequence: event.sequence,
        type: event.type,
        status: event.status,
        message: redactAndLimit(event.message, 700),
        payload: redactJson(event.payloadJson),
        createdAt: event.createdAt.toISOString()
      })),
      toolCalls: run.toolCalls.map((toolCall) => ({
        id: toolCall.id,
        toolName: toolCall.toolName,
        toolVersion: toolCall.toolVersion,
        risk: toolCall.risk,
        status: toolCall.status,
        input: redactJson(toolCall.inputJson),
        output: redactJson(toolCall.outputJson),
        error: redactAndLimit(toolCall.error, 700),
        startedAt: toolCall.startedAt.toISOString(),
        finishedAt: toolCall.finishedAt?.toISOString() ?? null
      })),
      checkpoints: run.checkpoints.map((checkpoint) => ({
        id: checkpoint.id,
        nodeName: checkpoint.nodeName,
        status: checkpoint.status,
        state: redactJson(checkpoint.stateJson),
        createdAt: checkpoint.createdAt.toISOString()
      }))
    })),
    runStatuses: runStatusGroups.map((group) => ({
      status: group.status,
      count: group._count._all
    })),
    proposals: proposals.map((proposal) => ({
      id: proposal.id,
      status: proposal.status,
      title: proposal.title,
      summary: proposal.summary,
      source: proposal.source,
      createdAt: proposal.createdAt.toISOString(),
      decidedAt: proposal.decidedAt?.toISOString() ?? null,
      executedAt: proposal.executedAt?.toISOString() ?? null,
      changes: proposal.changes.map((change) => ({
        id: change.id,
        patchType: change.patchType,
        targetType: change.targetType,
        targetField: change.targetField,
        sectionKey: change.sectionKey,
        status: change.status,
        before: redactJson(change.beforeValueJson),
        after: redactJson(change.afterValueJson)
      })),
      approvals: proposal.approvals.map((approval) => ({
        id: approval.id,
        decision: approval.decision,
        decidedBy: approval.decidedBy,
        reason: approval.reason,
        createdAt: approval.createdAt.toISOString()
      }))
    })),
    memory: {
      items: memoryItems.map((memory) => ({
        id: memory.id,
        scope: memory.scope,
        category: memory.category,
        status: memory.status,
        content: redactAndLimit(memory.content, 900),
        rationale: redactAndLimit(memory.rationale, 600),
        sensitivity: memory.sensitivity,
        confidence: memory.confidence,
        lastUsedAt: memory.lastUsedAt?.toISOString() ?? null,
        updatedAt: memory.updatedAt.toISOString()
      })),
      candidates: memoryCandidates.map((candidate) => ({
        id: candidate.id,
        category: candidate.category,
        status: candidate.status,
        content: redactAndLimit(candidate.content, 900),
        rationale: redactAndLimit(candidate.rationale, 600),
        sensitivity: candidate.sensitivity,
        confidence: candidate.confidence,
        createdAt: candidate.createdAt.toISOString(),
        decidedAt: candidate.decidedAt?.toISOString() ?? null
      }))
    },
    knowledge: {
      documents: knowledgeDocuments.map((document) => ({
        id: document.id,
        namespace: document.namespace,
        visibility: document.visibility,
        sourceType: document.sourceType,
        title: document.title,
        version: document.version,
        status: document.status,
        sourceUri: document.sourceUri,
        chunkCount: document._count.chunks,
        updatedAt: document.updatedAt.toISOString()
      })),
      chunkCount: knowledgeChunks
    },
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      goal: task.goal,
      targetOpportunity: task.targetOpportunity,
      status: task.status,
      activeThreadId: task.activeThreadId,
      updatedAt: task.updatedAt.toISOString(),
      threads: task.threads.map((thread) => ({
        id: thread.id,
        chapterNumber: thread.chapterNumber,
        title: thread.title,
        status: thread.status,
        compactionCount: thread.compactionCount,
        tokenEstimate: thread.tokenEstimate,
        messageCount: thread.messageCount,
        rolloverReason: thread.rolloverReason,
        updatedAt: thread.updatedAt.toISOString()
      })),
      summaries: task.summaries.map((summary) => ({
        id: summary.id,
        coveredMessageCount: summary.coveredMessageCount,
        tokenEstimate: summary.tokenEstimate,
        createdAt: summary.createdAt.toISOString()
      }))
    })),
    jobs: {
      queues: queueHealth,
      pdfJobs: pdfJobs.map((job) => ({
        id: job.id,
        status: job.status,
        templateKey: job.templateKey,
        message: redactAndLimit(job.message, 500),
        attempts: job.attempts,
        createdAt: job.createdAt.toISOString(),
        startedAt: job.startedAt?.toISOString() ?? null,
        finishedAt: job.finishedAt?.toISOString() ?? null,
        failedAt: job.failedAt?.toISOString() ?? null
      })),
      importJobs: importJobs.map((job) => ({
        id: job.id,
        status: job.status,
        stage: job.stage,
        sourceFilename: job.sourceFilename,
        message: redactAndLimit(job.message || job.error, 500),
        createdAt: job.createdAt.toISOString(),
        finishedAt: job.finishedAt?.toISOString() ?? null
      }))
    },
    policy: {
      tools: toolPolicyList,
      intentMatrix,
      guardrails: [
        "Normal profile edits are proposals first and require explicit approval.",
        "Execution-risk tools are blocked from model exposure.",
        "Attachment extraction is treated as untrusted evidence.",
        "Knowledge retrieval is workspace-scoped and system/workspace namespaces are explicit.",
        "Memory promotion requires review and can be deleted.",
        "Prompt/context snapshots shown here are redacted and limited; full raw provider payloads are not stored."
      ]
    },
    configuration: {
      features: featureFlagNames.map((name) => ({ name, value: process.env[name] ?? "" })),
      models: modelFlagNames.map((name) => ({ name, value: process.env[name] ?? "" })),
      secrets: secretFlagNames.map((name) => ({ name, configured: Boolean(process.env[name]) })),
      runtime: {
        nodeEnv: process.env.NODE_ENV ?? "",
        appUrl: process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? "",
        adminAllowlistConfigured: adminEmails().length > 0,
        fileStorageConfigured: Boolean(process.env.CVSCHOLAR_FILE_STORAGE_DIR),
        r2Configured: Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_PRIVATE_BUCKET)
      }
    }
  });
}

async function loadQueueHealth() {
  if (!process.env.REDIS_URL) {
    return [
      {
        name: "redis",
        status: "not_configured",
        error: "REDIS_URL is not configured for this runtime."
      }
    ];
  }

  const queueFactories = [
    ["Agent runs", getAgentRunQueue],
    ["PDF renders", getPdfRenderQueue],
    ["CV imports", getCvImportQueue],
    ["Attachment extraction", getAgentAttachmentExtractionQueue]
  ] as const;

  return Promise.all(
    queueFactories.map(async ([name, factory]) => {
      try {
        const counts = await factory().getJobCounts("waiting", "active", "completed", "failed", "delayed", "paused");
        return {
          name,
          status: "ok",
          counts
        };
      } catch (error) {
        return {
          name,
          status: "error",
          error: error instanceof Error ? error.message : "Could not read queue."
        };
      }
    })
  );
}

function redactAndLimit(value: string, maxLength: number) {
  const redacted = value
    .replace(/sk-[A-Za-z0-9_-]{16,}/g, "[redacted-api-key]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/password["']?\s*[:=]\s*["'][^"']+["']/gi, "password: [redacted]");
  return redacted.length > maxLength ? `${redacted.slice(0, maxLength)}...` : redacted;
}

function redactJson(value: unknown): unknown {
  if (typeof value === "string") return redactAndLimit(value, 1200);
  if (Array.isArray(value)) return value.slice(0, 20).map(redactJson);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => {
      if (/secret|token|password|api.?key|authorization/i.test(key)) {
        return [key, "[redacted]"];
      }
      return [key, redactJson(item)];
    })
  );
}
