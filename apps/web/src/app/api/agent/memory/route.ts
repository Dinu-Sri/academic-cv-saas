import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  clearAllAgentMemory,
  deleteMemoryItem,
  promoteMemoryCandidate,
  rejectMemoryCandidate
} from "@/lib/agent/memory";
import { prisma } from "@/lib/prisma";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

const memoryActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.enum(["promote_candidate", "reject_candidate", "delete_memory"]),
    id: z.string().min(1)
  }),
  z.object({
    action: z.literal("clear_all")
  })
]);

export async function GET() {
  const resolved = await resolveWorkspace();
  if (!resolved) {
    return NextResponse.json({ error: "Please login before viewing agent memory." }, { status: 401 });
  }

  const [items, candidates] = await Promise.all([
    prisma.agentMemoryItem.findMany({
      where: {
        workspaceId: resolved.workspace.id,
        profileId: resolved.profile.id,
        status: "active"
      },
      orderBy: [{ lastUsedAt: "desc" }, { updatedAt: "desc" }],
      take: 80
    }),
    prisma.agentMemoryCandidate.findMany({
      where: {
        workspaceId: resolved.workspace.id,
        profileId: resolved.profile.id,
        status: "pending"
      },
      orderBy: { createdAt: "desc" },
      take: 80
    })
  ]);

  return NextResponse.json({
    ok: true,
    memories: items.map((item) => ({
      id: item.id,
      scope: item.scope,
      category: item.category,
      content: item.content,
      rationale: item.rationale,
      confidence: item.confidence,
      sensitivity: item.sensitivity,
      lastUsedAt: item.lastUsedAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString()
    })),
    candidates: candidates.map((candidate) => ({
      id: candidate.id,
      category: candidate.category,
      content: candidate.content,
      rationale: candidate.rationale,
      confidence: candidate.confidence,
      sensitivity: candidate.sensitivity,
      createdAt: candidate.createdAt.toISOString()
    }))
  });
}

export async function POST(request: Request) {
  const resolved = await resolveWorkspace();
  if (!resolved) {
    return NextResponse.json({ error: "Please login before managing agent memory." }, { status: 401 });
  }

  const payload = memoryActionSchema.parse(await request.json());
  if (payload.action === "clear_all") {
    await clearAllAgentMemory(resolved.workspace.id, resolved.profile.id);
  } else if (payload.action === "promote_candidate") {
    await promoteMemoryCandidate(payload.id, resolved.workspace.id, resolved.profile.id);
  } else if (payload.action === "reject_candidate") {
    await rejectMemoryCandidate(payload.id, resolved.workspace.id, resolved.profile.id);
  } else {
    await deleteMemoryItem(payload.id, resolved.workspace.id, resolved.profile.id);
  }

  return GET();
}

async function resolveWorkspace() {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) return null;
  return getOrCreateWorkspaceForUser(session.user);
}
