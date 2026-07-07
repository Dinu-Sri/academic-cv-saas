import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { defaultVisibleSectionKeys, profileSections } from "@/lib/profile-sections";
import { prisma } from "@/lib/prisma";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

const updateSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  templateKey: z.enum(["classic", "modern", "detailed"]).optional(),
  visibleSectionKeys: z.array(z.string()).optional()
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Please login before updating this CV." }, { status: 401 });
  }

  const { id } = await context.params;
  const payload = updateSchema.parse(await request.json());
  const { profile } = await getOrCreateWorkspaceForUser(session.user);
  const existing = await prisma.cvDocument.findFirst({
    where: {
      id,
      profileId: profile.id
    }
  });

  if (!existing) {
    return NextResponse.json({ error: "CV version was not found." }, { status: 404 });
  }

  const validKeys = new Set<string>(profileSections.map((section) => section.key));
  const visibleSectionKeys = payload.visibleSectionKeys
    ?.filter((key) => validKeys.has(key));

  const document = await prisma.cvDocument.update({
    where: { id: existing.id },
    data: {
      ...(payload.title ? { title: payload.title } : {}),
      ...(payload.templateKey ? { templateKey: payload.templateKey } : {}),
      ...(visibleSectionKeys ? { visibleSectionKeys: visibleSectionKeys.length > 0 ? visibleSectionKeys : defaultVisibleSectionKeys } : {})
    }
  });

  return NextResponse.json({
    ok: true,
    document: {
      id: document.id,
      title: document.title,
      templateKey: document.templateKey,
      visibleSectionKeys: Array.isArray(document.visibleSectionKeys) ? document.visibleSectionKeys : defaultVisibleSectionKeys,
      pdfReady: Boolean(document.pdfPath),
      pdfError: document.renderError,
      updatedAt: document.updatedAt.toISOString()
    }
  });
}
