import { NextResponse } from "next/server";
import {
  assertGuestPublicationTaskAllowed,
  incrementGuestPublicationTask
} from "@/lib/guest";
import type { RequestActor } from "@/lib/request-user";

export async function publicationTaskLimitResponse(actor: RequestActor) {
  if (!actor.isGuest) return null;
  const allowance = await assertGuestPublicationTaskAllowed(actor.user.id);
  if (allowance.ok) return null;
  return NextResponse.json(allowance, { status: 402 });
}

export async function recordPublicationTask(actor: RequestActor) {
  if (!actor.isGuest) return;
  await incrementGuestPublicationTask(actor.user.id);
}
