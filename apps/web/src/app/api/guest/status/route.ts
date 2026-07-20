import { NextResponse } from "next/server";
import { resolveRequestActor } from "@/lib/request-user";
import { GUEST_MAX_CHAT, GUEST_MAX_COMPILE } from "@/lib/guest";

export async function GET() {
  const actor = await resolveRequestActor({ allowGuest: true });
  if (!actor) {
    return NextResponse.json({ isGuest: false, authenticated: false });
  }

  return NextResponse.json({
    authenticated: !actor.isGuest,
    isGuest: actor.isGuest,
    usage: actor.usage,
    limits: {
      maxCompile: GUEST_MAX_COMPILE,
      maxChat: GUEST_MAX_CHAT
    }
  });
}
