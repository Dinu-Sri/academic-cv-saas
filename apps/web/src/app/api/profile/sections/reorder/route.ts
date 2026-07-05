import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

const reorderSchema = z.object({
  order: z.array(z.string()).max(100)
});

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Please login before editing your profile." }, { status: 401 });
  }

  const { profile } = await getOrCreateWorkspaceForUser(session.user);
  const payload = reorderSchema.parse(await request.json());
  const sections = await prisma.profileSection.findMany({
    where: {
      profileId: profile.id,
      id: { in: payload.order }
    },
    select: { id: true }
  });
  const ownedIds = new Set(sections.map((section) => section.id));
  const validOrder = payload.order.filter((id) => ownedIds.has(id));

  await prisma.$transaction(
    validOrder.map((id, index) =>
      prisma.profileSection.update({
        where: { id },
        data: { sectionOrder: (index + 1) * 10 }
      })
    )
  );

  return NextResponse.json({ ok: true });
}
