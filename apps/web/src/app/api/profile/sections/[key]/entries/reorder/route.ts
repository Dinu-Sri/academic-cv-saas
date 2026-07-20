import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveRequestActor } from "@/lib/request-user";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

const reorderSchema = z.object({
  order: z.array(z.string()).max(200)
});

export async function POST(request: Request, context: { params: Promise<{ key: string }> }) {
  const actor = await resolveRequestActor({ allowGuest: true });

  if (!actor) {
    return NextResponse.json({ error: "Please login before editing your profile." }, { status: 401 });
  }

  const { key } = await context.params;
  const { profile } = await getOrCreateWorkspaceForUser(actor.user);
  const payload = reorderSchema.parse(await request.json());

  const ownedEntries = await prisma.profileSectionEntry.findMany({
    where: {
      profileId: profile.id,
      sectionKey: key,
      id: { in: payload.order },
      archivedAt: null
    },
    select: { id: true }
  });

  const ownedIds = new Set(ownedEntries.map((entry) => entry.id));
  const validOrder = payload.order.filter((id) => ownedIds.has(id));

  await prisma.$transaction(
    validOrder.map((id, index) =>
      prisma.profileSectionEntry.update({
        where: { id },
        data: { entryOrder: index + 1, version: { increment: 1 } }
      })
    )
  );

  return NextResponse.json({ ok: true });
}
