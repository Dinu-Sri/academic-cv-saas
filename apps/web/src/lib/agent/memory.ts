import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type MemoryCandidateCategory =
  | "task_specific"
  | "stable_preference"
  | "academic_fact_candidate"
  | "sensitive"
  | "irrelevant";

export type MemoryCandidateDraft = {
  category: MemoryCandidateCategory;
  content: string;
  rationale: string;
  confidence: number;
  sensitivity?: string;
  evidenceJson?: Prisma.InputJsonValue;
};

type MemoryScope = {
  workspaceId: string;
  profileId: string;
  taskId?: string;
  threadId?: string;
  runId?: string;
  messageId?: string;
};

export async function createMemoryCandidates(scope: MemoryScope, drafts: MemoryCandidateDraft[]) {
  const safeDrafts = drafts
    .map((draft) => ({
      ...draft,
      content: draft.content.trim(),
      rationale: draft.rationale.trim(),
      confidence: clampConfidence(draft.confidence),
      sensitivity: draft.sensitivity || (draft.category === "sensitive" ? "sensitive" : "normal")
    }))
    .filter((draft) => draft.content.length > 0 && draft.category !== "irrelevant")
    .slice(0, 6);

  if (safeDrafts.length === 0) return [];

  const created = [];
  for (const draft of safeDrafts) {
    const existing = await prisma.agentMemoryCandidate.findFirst({
      where: {
        workspaceId: scope.workspaceId,
        profileId: scope.profileId,
        status: "pending",
        content: draft.content
      },
      select: { id: true }
    });

    if (existing) continue;

    created.push(
      await prisma.agentMemoryCandidate.create({
        data: {
          workspaceId: scope.workspaceId,
          profileId: scope.profileId,
          taskId: scope.taskId,
          threadId: scope.threadId,
          runId: scope.runId ?? "",
          messageId: scope.messageId ?? "",
          category: draft.category,
          content: draft.content,
          rationale: draft.rationale,
          confidence: draft.confidence,
          sensitivity: draft.sensitivity,
          evidenceJson: draft.evidenceJson ?? {}
        }
      })
    );
  }

  return created;
}

export async function promoteMemoryCandidate(candidateId: string, workspaceId: string, profileId: string) {
  const candidate = await prisma.agentMemoryCandidate.findFirst({
    where: {
      id: candidateId,
      workspaceId,
      profileId,
      status: "pending"
    }
  });

  if (!candidate) {
    throw new Error("Memory candidate was not found or is no longer pending.");
  }

  const item = await prisma.agentMemoryItem.create({
    data: {
      workspaceId,
      profileId,
      taskId: candidate.category === "task_specific" ? candidate.taskId : null,
      threadId: candidate.category === "task_specific" ? candidate.threadId : null,
      candidateId: candidate.id,
      scope: candidate.category === "task_specific" ? "task" : "profile",
      category: candidate.category,
      content: candidate.content,
      rationale: candidate.rationale,
      retrievalText: normalizeForSearch(`${candidate.content} ${candidate.rationale}`),
      evidenceJson: (candidate.evidenceJson ?? {}) as Prisma.InputJsonValue,
      sensitivity: candidate.sensitivity,
      confidence: candidate.confidence
    }
  });

  await prisma.agentMemoryCandidate.update({
    where: { id: candidate.id },
    data: {
      status: "promoted",
      promotedMemoryId: item.id,
      decidedAt: new Date()
    }
  });

  return item;
}

export async function rejectMemoryCandidate(candidateId: string, workspaceId: string, profileId: string) {
  return prisma.agentMemoryCandidate.updateMany({
    where: {
      id: candidateId,
      workspaceId,
      profileId,
      status: "pending"
    },
    data: {
      status: "rejected",
      decidedAt: new Date()
    }
  });
}

export async function deleteMemoryItem(memoryId: string, workspaceId: string, profileId: string) {
  return prisma.agentMemoryItem.updateMany({
    where: {
      id: memoryId,
      workspaceId,
      profileId,
      status: "active"
    },
    data: {
      status: "deleted"
    }
  });
}

/** Clear all active memories + pending candidates for a profile (user privacy action). */
export async function clearAllAgentMemory(workspaceId: string, profileId: string) {
  const [items, candidates] = await Promise.all([
    prisma.agentMemoryItem.updateMany({
      where: { workspaceId, profileId, status: "active" },
      data: { status: "deleted" }
    }),
    prisma.agentMemoryCandidate.updateMany({
      where: { workspaceId, profileId, status: "pending" },
      data: { status: "rejected", decidedAt: new Date() }
    })
  ]);
  return { deletedMemories: items.count, rejectedCandidates: candidates.count };
}

export async function retrieveRelevantMemories({
  workspaceId,
  profileId,
  taskId,
  query,
  limit = 6
}: {
  workspaceId: string;
  profileId: string;
  taskId?: string;
  query: string;
  limit?: number;
}) {
  const memories = await prisma.agentMemoryItem.findMany({
    where: {
      workspaceId,
      profileId,
      status: "active",
      OR: [{ scope: "profile" }, ...(taskId ? [{ taskId }] : [])]
    },
    orderBy: [{ lastUsedAt: "desc" }, { updatedAt: "desc" }],
    take: 80
  });

  const queryTerms = terms(query);
  const ranked = memories
    .map((memory) => {
      const text = memory.retrievalText || normalizeForSearch(`${memory.content} ${memory.rationale}`);
      return {
        memory,
        score: queryTerms.length ? queryTerms.reduce((score, term) => score + (text.includes(term) ? 1 : 0), 0) : 1
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.memory.updatedAt.getTime() - a.memory.updatedAt.getTime())
    .slice(0, limit)
    .map((item) => item.memory);

  if (ranked.length > 0) {
    await prisma.agentMemoryItem.updateMany({
      where: { id: { in: ranked.map((memory) => memory.id) } },
      data: { lastUsedAt: new Date() }
    });
  }

  return ranked.map((memory) => ({
    id: memory.id,
    scope: memory.scope,
    category: memory.category,
    content: memory.content,
    rationale: memory.rationale,
    confidence: memory.confidence
  }));
}

export function extractMemoryCandidateDrafts(userMessage: string): MemoryCandidateDraft[] {
  const message = userMessage.trim();
  if (!message) return [];

  const lower = message.toLowerCase();
  const drafts: MemoryCandidateDraft[] = [];
  const preferenceMatch = message.match(/\b(?:i prefer|prefer|use|always use|please use)\s+(.{4,160})/i);
  if (preferenceMatch?.[1]) {
    drafts.push({
      category: "stable_preference",
      content: `User preference: ${preferenceMatch[1].trim().replace(/[.?!]+$/, "")}`,
      rationale: "The user explicitly stated a reusable CV or writing preference.",
      confidence: 0.82
    });
  }

  if (/\b(applying|application|job|grant|fellowship|postdoc|faculty|lecturer)\b/.test(lower)) {
    drafts.push({
      category: "task_specific",
      content: message.slice(0, 240),
      rationale: "The user described a task or target opportunity that may be useful for this task thread.",
      confidence: 0.62
    });
  }

  if (/\b(passport|nic|ssn|social security|medical|health|religion|political)\b/.test(lower)) {
    drafts.push({
      category: "sensitive",
      content: message.slice(0, 240),
      rationale: "The message appears to contain sensitive personal context and must require explicit user control.",
      confidence: 0.9,
      sensitivity: "sensitive"
    });
  }

  return drafts;
}

function terms(query: string) {
  return normalizeForSearch(query)
    .split(" ")
    .filter((term) => term.length > 2)
    .slice(0, 24);
}

function normalizeForSearch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function clampConfidence(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
