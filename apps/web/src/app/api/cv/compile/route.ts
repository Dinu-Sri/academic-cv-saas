import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildCvSnapshot, buildPreviewHtml, refreshCompleteness } from "@/lib/profile-editor";
import { prisma } from "@/lib/prisma";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

export async function POST() {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Please login before compiling your CV." }, { status: 401 });
  }

  const { profile } = await getOrCreateWorkspaceForUser(session.user);
  const snapshot = await buildCvSnapshot(profile.id);
  const previewHtml = buildPreviewHtml(snapshot);
  const snapshotJson = JSON.parse(JSON.stringify(snapshot));

  const existingDocument = await prisma.cvDocument.findFirst({
    where: { profileId: profile.id },
    select: { id: true }
  });

  const document = existingDocument
    ? await prisma.cvDocument.update({
        where: { id: existingDocument.id },
        data: {
          snapshot: snapshotJson,
          previewHtml,
          lastCompiledAt: new Date()
        }
      })
    : await prisma.cvDocument.create({
        data: {
          profileId: profile.id,
          title: "Academic CV",
          templateKey: "classic",
          snapshot: snapshotJson,
          previewHtml,
          lastCompiledAt: new Date()
        }
      });

  await prisma.cvRenderJob.create({
    data: {
      profileId: profile.id,
      documentId: document.id,
      status: "preview_ready",
      message: "Preview compiled from structured profile data.",
      previewHtml
    }
  });

  const completeness = await refreshCompleteness(profile.id);

  return NextResponse.json({
    ok: true,
    documentId: document.id,
    previewHtml,
    completeness
  });
}
