import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { GUEST_MAX_CHAT, GUEST_MAX_COMPILE, peekGuestActor } from "@/lib/guest";
import { prisma } from "@/lib/prisma";

/** Lightweight: never creates guest workspace (home page stays fast). */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.id) {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isGuest: true }
    });
    if (dbUser && !dbUser.isGuest) {
      return NextResponse.json({
        authenticated: true,
        isGuest: false,
        usage: null,
        limits: { maxCompile: GUEST_MAX_COMPILE, maxChat: GUEST_MAX_CHAT }
      });
    }
  }

  const guest = await peekGuestActor();
  if (!guest) {
    return NextResponse.json({
      authenticated: false,
      isGuest: true,
      usage: null,
      limits: { maxCompile: GUEST_MAX_COMPILE, maxChat: GUEST_MAX_CHAT }
    });
  }

  const exhausted =
    guest.usage.compileRemaining <= 0 || guest.usage.chatRemaining <= 0;

  return NextResponse.json({
    authenticated: false,
    isGuest: true,
    usage: guest.usage,
    exhausted,
    limits: {
      maxCompile: GUEST_MAX_COMPILE,
      maxChat: GUEST_MAX_CHAT
    }
  });
}
