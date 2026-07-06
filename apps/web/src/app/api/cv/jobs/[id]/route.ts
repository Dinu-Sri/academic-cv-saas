import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Please login before checking PDF status." }, { status: 401 });
  }

  const { id } = await context.params;
  const { workspace } = await getOrCreateWorkspaceForUser(session.user);
  const job = await prisma.pdfRenderJob.findFirst({
    where: {
      id,
      workspaceId: workspace.id
    },
    include: {
      fileAsset: true,
      document: true
    }
  });

  if (!job) {
    return NextResponse.json({ error: "PDF job not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    jobId: job.id,
    status: job.status,
    message: job.message,
    pdfReady: job.status === "completed" && Boolean(job.fileAssetId),
    pdfError: job.status === "failed" ? job.message : "",
    previewHtml: job.document.previewHtml,
    fileAssetId: job.fileAssetId
  });
}
