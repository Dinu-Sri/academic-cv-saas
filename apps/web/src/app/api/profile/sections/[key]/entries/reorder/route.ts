import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

const reorderSchema = z.object({
  order: z.array(z.string()).max(200)
});

export async function POST(request: Request, context: { params: Promise<{ key: string }> }) {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Please login before editing your profile." }, { status: 401 });
  }

  const { key } = await context.params;
  const { profile } = await getOrCreateWorkspaceForUser(session.user);
  const payload = reorderSchema.parse(await request.json());

  const ownedEntries = await prisma.profileSectionEntry.findMany({
    where: {
      profileId: profile.id,
      sectionKey: key,
      id: { in: payload.order }
    },
    select: { id: true }
  });

  const ownedIds = new Set(ownedEntries.map((entry) => entry.id));
  const validOrder = payload.order.filter((id) => ownedIds.has(id));

  await prisma.$transaction(
    validOrder.map((id, index) =>
      prisma.profileSectionEntry.update({
        where: { id },
        data: { entryOrder: index + 1 }
      })
    )
  );

  return NextResponse.json({ ok: true });
}
