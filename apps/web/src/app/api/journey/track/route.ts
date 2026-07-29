import { randomUUID } from "crypto";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { peekGuestActor } from "@/lib/guest";
import { prisma } from "@/lib/prisma";

const JOURNEY_COOKIE = "cvscholar_journey";
const eventSchema = z.object({
  eventName: z.string().trim().min(1).max(80).regex(/^[a-z0-9_:-]+$/),
  path: z.string().trim().max(300).default(""),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({})
});

export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > 4_000) return NextResponse.json({ error: "Event payload is too large." }, { status: 413 });
  const payload = eventSchema.parse(JSON.parse(raw));
  const cookieStore = await cookies();
  const existingSessionId = cookieStore.get(JOURNEY_COOKIE)?.value;
  const sessionId = existingSessionId || randomUUID();
  const session = await auth.api.getSession({ headers: await headers() });
  const guest = session?.user?.id ? null : await peekGuestActor();
  const userId = session?.user?.id || guest?.user.id || "";
  const actorType = session?.user?.id ? "registered" : "guest";
  const recentCount = await prisma.journeyEvent.count({
    where: { sessionId, createdAt: { gte: new Date(Date.now() - 60_000) } }
  });
  if (recentCount >= 120) return NextResponse.json({ error: "Event rate limit reached." }, { status: 429 });

  await prisma.journeyEvent.create({
    data: {
      sessionId,
      userId,
      actorType,
      eventName: payload.eventName,
      path: payload.path,
      metadata: payload.metadata
    }
  });
  if (!existingSessionId) {
    cookieStore.set(JOURNEY_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 365 * 24 * 60 * 60
    });
  }
  return NextResponse.json({ ok: true }, { status: 202 });
}
