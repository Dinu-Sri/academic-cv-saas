import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { buildCvImportReview } from "@/lib/cv-import";
import { prisma } from "@/lib/prisma";
import { resolveRequestActor } from "@/lib/request-user";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await resolveRequestActor({ allowGuest: true });

  if (!actor) {
    return NextResponse.json({ error: "Please login before checking an import." }, { status: 401 });
  }

  const { id } = await context.params;
  const { profile } = await getOrCreateWorkspaceForUser(actor.user);
  const job = await prisma.cvImportJob.findFirst({
    where: {
      id,
      profileId: profile.id
    }
  });

  if (!job) {
    return NextResponse.json({ error: "Import job not found." }, { status: 404 });
  }

  const review = job.status === "ready" || job.status === "applied" ? await buildCvImportReview(profile.id, job.draftJson) : null;

  return NextResponse.json({
    ok: true,
    job: {
      id: job.id,
      status: job.status,
      stage: job.stage,
      message: job.message,
      sourceFilename: job.sourceFilename,
      byteSize: job.byteSize,
      stats: job.statsJson,
      warnings: job.warnings,
      error: job.error,
      mergeResult: job.mergeResult,
      review,
      createdAt: job.createdAt.toISOString(),
      appliedAt: job.appliedAt?.toISOString() ?? null
    }
  });
}
