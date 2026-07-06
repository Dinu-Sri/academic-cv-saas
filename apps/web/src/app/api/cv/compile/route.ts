import { headers } from "next/headers";
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getPdfRenderQueue } from "@/lib/pdf-queue";
import { buildCvSnapshot, buildPreviewHtml, refreshCompleteness } from "@/lib/profile-editor";
import { prisma } from "@/lib/prisma";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

const compileSchema = z.object({
  templateKey: z.enum(["classic", "modern", "detailed"]).default("classic")
});

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Please login before compiling your CV." }, { status: 401 });
  }

  const body = await request.text();
  const payload = compileSchema.parse(body ? JSON.parse(body) : {});
  const { workspace, profile } = await getOrCreateWorkspaceForUser(session.user);
  const snapshot = await buildCvSnapshot(profile.id);
  const previewHtml = buildPreviewHtml(snapshot);
  const snapshotJson = JSON.parse(JSON.stringify(snapshot));
  const inputHash = crypto.createHash("sha256").update(JSON.stringify(snapshotJson)).digest("hex");

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
          templateKey: payload.templateKey,
          renderEngine: "tectonic",
          renderError: "",
          lastCompiledAt: new Date()
        }
      })
    : await prisma.cvDocument.create({
        data: {
          profileId: profile.id,
          title: "Academic CV",
          templateKey: payload.templateKey,
          snapshot: snapshotJson,
          previewHtml,
          renderEngine: "tectonic",
          renderError: "",
          lastCompiledAt: new Date()
        }
      });

  const renderJob = await prisma.pdfRenderJob.create({
    data: {
      workspaceId: workspace.id,
      profileId: profile.id,
      documentId: document.id,
      templateKey: payload.templateKey,
      status: "queued",
      message: "PDF render queued.",
      inputHash,
      templateVersion: "1.0.0"
    }
  });

  await getPdfRenderQueue().add(
    "render-classic-cv",
    {
      jobId: renderJob.id,
      workspaceId: workspace.id,
      profileId: profile.id,
      documentId: document.id
    },
    {
      jobId: renderJob.id
    }
  );

  const completeness = await refreshCompleteness(profile.id);

  return NextResponse.json({
    ok: true,
    documentId: document.id,
    jobId: renderJob.id,
    status: renderJob.status,
    previewHtml,
    pdfReady: false,
    pdfError: "",
    completeness
  });
}
