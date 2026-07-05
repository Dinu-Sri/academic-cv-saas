import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Please login before viewing your CV preview." }, { status: 401 });
  }

  const { profile } = await getOrCreateWorkspaceForUser(session.user);
  const document = await prisma.cvDocument.findFirst({
    where: { profileId: profile.id },
    orderBy: { updatedAt: "desc" }
  });

  return NextResponse.json({
    ok: true,
    previewHtml: document?.previewHtml ?? "",
    lastCompiledAt: document?.lastCompiledAt ?? null
  });
}
