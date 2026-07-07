import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildCvImportReview } from "@/lib/cv-import";
import { getCvImportQueue } from "@/lib/cv-import-queue";
import { storeImportPdf } from "@/lib/file-storage";
import { prisma } from "@/lib/prisma";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

const defaultMaxMb = 8;

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Please login before importing a CV." }, { status: 401 });
  }

  const { profile } = await getOrCreateWorkspaceForUser(session.user);
  const job = await prisma.cvImportJob.findFirst({
    where: {
      profileId: profile.id,
      status: { in: ["queued", "processing", "ready"] },
      appliedAt: null
    },
    orderBy: { createdAt: "desc" }
  });

  if (!job) {
    return NextResponse.json({ ok: true, job: null });
  }

  return NextResponse.json({ ok: true, job: await serializeImportJob(job, profile.id) });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Please login before importing a CV." }, { status: 401 });
  }

  const { workspace, profile } = await getOrCreateWorkspaceForUser(session.user);
  const activeJob = await prisma.cvImportJob.findFirst({
    where: {
      profileId: profile.id,
      status: { in: ["queued", "processing"] },
      appliedAt: null
    },
    orderBy: { createdAt: "desc" }
  });

  if (activeJob) {
    return NextResponse.json({ ok: true, active: true, job: await serializeImportJob(activeJob, profile.id) });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose an old CV PDF to import." }, { status: 422 });
  }

  const maxMb = Number.parseInt(process.env.CVSCHOLAR_CV_IMPORT_MAX_UPLOAD_MB || String(defaultMaxMb), 10);
  const maxBytes = Math.max(1, maxMb) * 1024 * 1024;

  if (file.size <= 0) {
    return NextResponse.json({ error: "The selected PDF is empty." }, { status: 422 });
  }

  if (file.size > maxBytes) {
    return NextResponse.json({ error: `Please upload a PDF smaller than ${maxMb} MB.` }, { status: 422 });
  }

  const filename = file.name || "old-cv.pdf";
  const looksLikePdf = filename.toLowerCase().endsWith(".pdf") || file.type === "application/pdf" || file.type === "application/x-pdf";
  if (!looksLikePdf) {
    return NextResponse.json({ error: "Only PDF files can be imported." }, { status: 422 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!bytes.subarray(0, 4).equals(Buffer.from("%PDF"))) {
    return NextResponse.json({ error: "This file does not look like a valid PDF." }, { status: 422 });
  }

  const stored = await storeImportPdf({ bytes, workspaceId: workspace.id, filename });
  const asset = await prisma.fileAsset.create({
    data: {
      workspaceId: workspace.id,
      profileId: profile.id,
      kind: "old_cv_import_pdf",
      storageProvider: stored.storageProvider,
      bucket: stored.bucket,
      objectKey: stored.objectKey,
      localPath: stored.localPath,
      filename: stored.filename,
      mimeType: stored.mimeType,
      byteSize: stored.byteSize,
      checksumSha256: stored.checksumSha256,
      isPublic: false
    }
  });

  const job = await prisma.cvImportJob.create({
    data: {
      workspaceId: workspace.id,
      profileId: profile.id,
      fileAssetId: asset.id,
      status: "queued",
      stage: "uploaded",
      message: "Old CV uploaded. Reading will start shortly.",
      sourceFilename: filename,
      mimeType: stored.mimeType,
      byteSize: stored.byteSize
    }
  });

  await getCvImportQueue().add(
    "import-old-cv",
    {
      jobId: job.id,
      workspaceId: workspace.id,
      profileId: profile.id,
      fileAssetId: asset.id
    },
    { jobId: job.id }
  );

  return NextResponse.json({ ok: true, job: await serializeImportJob(job, profile.id) });
}

async function serializeImportJob(
  job: {
    id: string;
    status: string;
    stage: string;
    message: string;
    sourceFilename: string;
    byteSize: number;
    draftJson: unknown;
    statsJson: unknown;
    warnings: unknown;
    error: string;
    mergeResult: unknown;
    createdAt: Date;
    appliedAt: Date | null;
  },
  profileId: string
) {
  const review = job.status === "ready" || job.status === "applied" ? await buildCvImportReview(profileId, job.draftJson) : null;

  return {
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
  };
}
