import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { queueAgentMessage, sendAgentMessage } from "@/lib/cv-agent/service";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

const runSchema = z.object({
  message: z.string().trim().max(5000).default(""),
  attachmentIds: z.array(z.string().trim().min(1)).max(8).default([])
});

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Please login before starting an agent run." }, { status: 401 });
  }

  const payload = runSchema.parse(await request.json());
  if (!payload.message && payload.attachmentIds.length === 0) {
    return NextResponse.json({ error: "Send a message or attach a file first." }, { status: 422 });
  }

  const { workspace, profile } = await getOrCreateWorkspaceForUser(session.user);
  const runsEnabled = process.env.CVSCHOLAR_AGENT_RUNS_ENABLED !== "0";
  const useWorker = runsEnabled && process.env.CVSCHOLAR_AGENT_WORKER_ENABLED !== "0";
  const result = await (useWorker ? queueAgentMessage : sendAgentMessage)({
    workspaceId: workspace.id,
    profileId: profile.id,
    message: payload.message,
    attachmentIds: payload.attachmentIds
  });

  return NextResponse.json({ ok: true, ...result });
}
