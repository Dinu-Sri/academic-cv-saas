import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveRequestActor } from "@/lib/request-user";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

export async function GET() {
  const actor = await resolveRequestActor({ allowGuest: true });

  if (!actor) {
    return NextResponse.json({ error: "Please login before viewing agent activity." }, { status: 401 });
  }

  const { workspace, profile } = await getOrCreateWorkspaceForUser(actor.user);
  const [runs, proposals, tasks] = await Promise.all([
    prisma.agentRun.findMany({
      where: { workspaceId: workspace.id, profileId: profile.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        events: {
          orderBy: { sequence: "desc" },
          take: 1
        }
      }
    }),
    prisma.agentProposal.findMany({
      where: { workspaceId: workspace.id, profileId: profile.id },
      orderBy: { createdAt: "desc" },
      take: 20
    }),
    prisma.agentTask.findMany({
      where: { workspaceId: workspace.id, profileId: profile.id },
      orderBy: { updatedAt: "desc" },
      take: 20,
      include: {
        threads: {
          orderBy: { chapterNumber: "desc" },
          take: 1
        }
      }
    })
  ]);

  return NextResponse.json({
    ok: true,
    runs: runs.map((run) => ({
      id: run.id,
      status: run.status,
      intent: run.intent,
      mode: run.mode,
      currentNode: run.currentNode,
      error: run.error,
      createdAt: run.createdAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
      lastEvent: run.events[0]
        ? {
            type: run.events[0].type,
            status: run.events[0].status,
            message: run.events[0].message,
            createdAt: run.events[0].createdAt.toISOString()
          }
        : null
    })),
    proposals: proposals.map((proposal) => ({
      id: proposal.id,
      title: proposal.title,
      status: proposal.status,
      summary: proposal.summary,
      createdAt: proposal.createdAt.toISOString(),
      decidedAt: proposal.decidedAt?.toISOString() ?? null
    })),
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      activeThreadId: task.activeThreadId,
      latestChapter: task.threads[0]?.chapterNumber ?? 1,
      updatedAt: task.updatedAt.toISOString()
    }))
  });
}
