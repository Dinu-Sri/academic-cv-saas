import { NextResponse } from "next/server";
import { recordCvActiveTime } from "@/lib/cv-time-to-value";
import { prisma } from "@/lib/prisma";
import { resolveRequestActor } from "@/lib/request-user";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

export async function POST() {
  const actor = await resolveRequestActor({ allowGuest: true });
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { workspace, profile } = await getOrCreateWorkspaceForUser(actor.user);
  await recordCvActiveTime(prisma, workspace.id, profile.id);
  return NextResponse.json({ ok: true }, { status: 202 });
}
