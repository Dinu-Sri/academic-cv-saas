import { NextResponse } from "next/server";
import { z } from "zod";
import { queueAgentMessage, sendAgentMessage } from "@/lib/cv-agent/service";
import {
  assertGuestChatAllowed,
  GUEST_LIMIT_CODE,
  incrementGuestChat
} from "@/lib/guest";
import { resolveRequestActor } from "@/lib/request-user";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

const runSchema = z.object({
  message: z.string().trim().max(5000).default(""),
  attachmentIds: z.array(z.string().trim().min(1)).max(8).default([])
});

export async function POST(request: Request) {
  const actor = await resolveRequestActor({ allowGuest: true });

  if (!actor) {
    return NextResponse.json({ error: "Please login before starting an agent run." }, { status: 401 });
  }

  if (actor.isGuest) {
    const gate = await assertGuestChatAllowed(actor.user.id);
    if (!gate.ok) {
      return NextResponse.json(
        {
          error: gate.error,
          code: GUEST_LIMIT_CODE,
          limit: gate.limit,
          used: gate.used,
          max: gate.max
        },
        { status: 402 }
      );
    }
  }

  const payload = runSchema.parse(await request.json());
  if (!payload.message && payload.attachmentIds.length === 0) {
    return NextResponse.json({ error: "Send a message or attach a file first." }, { status: 422 });
  }

  const { workspace, profile } = await getOrCreateWorkspaceForUser(actor.user);
  const runsEnabled = process.env.CVSCHOLAR_AGENT_RUNS_ENABLED !== "0";
  const useWorker = runsEnabled && process.env.CVSCHOLAR_AGENT_WORKER_ENABLED !== "0";
  const result = await (useWorker ? queueAgentMessage : sendAgentMessage)({
    workspaceId: workspace.id,
    profileId: profile.id,
    message: payload.message,
    attachmentIds: payload.attachmentIds
  });

  if (actor.isGuest) {
    await incrementGuestChat(actor.user.id);
  }

  return NextResponse.json({ ok: true, ...result });
}
