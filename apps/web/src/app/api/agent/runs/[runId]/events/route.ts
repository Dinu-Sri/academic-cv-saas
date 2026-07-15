import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

export async function GET(request: Request, context: { params: Promise<{ runId: string }> }) {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { runId } = await context.params;
  const { workspace, profile } = await getOrCreateWorkspaceForUser(session.user);
  const run = await prisma.agentRun.findFirst({
    where: {
      id: runId,
      workspaceId: workspace.id,
      profileId: profile.id
    },
    select: { id: true, status: true }
  });

  if (!run) {
    return new Response("Run not found", { status: 404 });
  }

  const encoder = new TextEncoder();
  const url = new URL(request.url);
  let cursor = Number.parseInt(url.searchParams.get("after") || "0", 10);
  if (!Number.isFinite(cursor)) cursor = 0;

  const stream = new ReadableStream({
    async start(controller) {
      let open = true;
      request.signal.addEventListener("abort", () => {
        open = false;
      });

      while (open) {
        const events = await prisma.agentEvent.findMany({
          where: {
            runId,
            sequence: { gt: cursor }
          },
          orderBy: { sequence: "asc" },
          take: 50
        });

        for (const event of events) {
          cursor = event.sequence;
          controller.enqueue(
            encoder.encode(
              [
                `id: ${event.sequence}`,
                `event: ${event.type}`,
                `data: ${JSON.stringify({
                  id: event.id,
                  sequence: event.sequence,
                  type: event.type,
                  status: event.status,
                  message: event.message,
                  payload: event.payloadJson,
                  createdAt: event.createdAt.toISOString()
                })}`,
                "",
                ""
              ].join("\n")
            )
          );
        }

        const latestRun = await prisma.agentRun.findUnique({
          where: { id: runId },
          select: { status: true }
        });

        if (latestRun?.status === "completed" || latestRun?.status === "paused" || latestRun?.status === "failed" || latestRun?.status === "cancelled") {
          controller.close();
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
