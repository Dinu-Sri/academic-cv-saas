import "dotenv/config";
import { readFile } from "node:fs/promises";
import { Worker } from "bullmq";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../web/src/generated/prisma/client";
import { compileClassicPdf } from "../../web/src/lib/latex";
import { storeGeneratedPdf } from "../../web/src/lib/file-storage";
import { getRedisConnectionOptions, PDF_RENDER_QUEUE, type PdfRenderQueuePayload } from "../../web/src/lib/pdf-queue";

const databaseUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;

if (!databaseUrl) {
  throw new Error("Missing required environment variable: DATABASE_URL");
}

if (!redisUrl) {
  throw new Error("Missing required environment variable: REDIS_URL");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: databaseUrl
  })
});

const concurrency = Number.parseInt(process.env.PDF_WORKER_CONCURRENCY || "1", 10);

const worker = new Worker<PdfRenderQueuePayload>(
  PDF_RENDER_QUEUE,
  async (queueJob) => {
    const payload = queueJob.data;
    const renderJob = await prisma.pdfRenderJob.findUnique({
      where: { id: payload.jobId },
      include: { document: true }
    });

    if (!renderJob) {
      throw new Error(`PDF render job ${payload.jobId} was not found.`);
    }

    await prisma.pdfRenderJob.update({
      where: { id: renderJob.id },
      data: {
        status: "processing",
        message: "Rendering Classic LaTeX PDF.",
        attempts: { increment: 1 },
        startedAt: new Date()
      }
    });

    try {
      const snapshot = renderJob.document.snapshot as Parameters<typeof compileClassicPdf>[0];
      const result = await compileClassicPdf(snapshot, renderJob.profileId);

      if (!result.ok) {
        await markFailed(renderJob.id, renderJob.documentId, result.error);
        throw new Error(result.error);
      }

      const bytes = await readFile(result.pdfPath);
      const stored = await storeGeneratedPdf({
        bytes,
        workspaceId: renderJob.workspaceId,
        documentId: renderJob.documentId,
        filename: result.pdfFilename
      });

      const asset = await prisma.fileAsset.create({
        data: {
          workspaceId: renderJob.workspaceId,
          profileId: renderJob.profileId,
          documentId: renderJob.documentId,
          kind: "generated_cv_pdf",
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

      await prisma.cvDocument.update({
        where: { id: renderJob.documentId },
        data: {
          pdfPath: stored.storageProvider === "local" ? stored.localPath : stored.objectKey,
          pdfFilename: stored.filename,
          renderEngine: result.engine,
          renderError: "",
          pdfGeneratedAt: new Date()
        }
      });

      await prisma.pdfRenderJob.update({
        where: { id: renderJob.id },
        data: {
          fileAssetId: asset.id,
          status: "completed",
          message: "Classic LaTeX PDF generated.",
          finishedAt: new Date()
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "PDF rendering failed.";
      await markFailed(renderJob.id, renderJob.documentId, message);
      throw error;
    }
  },
  {
    connection: getRedisConnectionOptions(),
    concurrency
  }
);

worker.on("completed", (job) => {
  console.log(`PDF job completed: ${job.id}`);
});

worker.on("failed", (job, error) => {
  console.error(`PDF job failed: ${job?.id ?? "unknown"}`, error);
});

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

async function markFailed(jobId: string, documentId: string, message: string) {
  await prisma.$transaction([
    prisma.pdfRenderJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        message,
        failedAt: new Date()
      }
    }),
    prisma.cvDocument.update({
      where: { id: documentId },
      data: {
        renderError: message
      }
    })
  ]);
}

async function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down PDF worker.`);
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
}
