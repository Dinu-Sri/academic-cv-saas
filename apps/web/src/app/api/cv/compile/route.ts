import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { compileClassicPdf } from "@/lib/latex";
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
  const { profile } = await getOrCreateWorkspaceForUser(session.user);
  const snapshot = await buildCvSnapshot(profile.id);
  const previewHtml = buildPreviewHtml(snapshot);
  const snapshotJson = JSON.parse(JSON.stringify(snapshot));
  const pdfResult = await compileClassicPdf(snapshot, profile.id);

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
          pdfPath: pdfResult.ok ? pdfResult.pdfPath : "",
          pdfFilename: pdfResult.ok ? pdfResult.pdfFilename : "",
          renderEngine: pdfResult.engine,
          renderError: pdfResult.ok ? "" : pdfResult.error,
          lastCompiledAt: new Date(),
          pdfGeneratedAt: pdfResult.ok ? new Date() : null
        }
      })
    : await prisma.cvDocument.create({
        data: {
          profileId: profile.id,
          title: "Academic CV",
          templateKey: payload.templateKey,
          snapshot: snapshotJson,
          previewHtml,
          pdfPath: pdfResult.ok ? pdfResult.pdfPath : "",
          pdfFilename: pdfResult.ok ? pdfResult.pdfFilename : "",
          renderEngine: pdfResult.engine,
          renderError: pdfResult.ok ? "" : pdfResult.error,
          lastCompiledAt: new Date(),
          pdfGeneratedAt: pdfResult.ok ? new Date() : null
        }
      });

  await prisma.cvRenderJob.create({
    data: {
      profileId: profile.id,
      documentId: document.id,
      status: pdfResult.ok ? "pdf_ready" : "pdf_failed",
      message: pdfResult.ok ? "Classic LaTeX PDF generated." : pdfResult.error,
      previewHtml
    }
  });

  const completeness = await refreshCompleteness(profile.id);

  return NextResponse.json({
    ok: true,
    documentId: document.id,
    previewHtml,
    pdfReady: pdfResult.ok,
    pdfError: pdfResult.ok ? "" : pdfResult.error,
    completeness
  });
}
