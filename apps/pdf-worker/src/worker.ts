import "dotenv/config";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { Worker } from "bullmq";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../web/src/generated/prisma/client";
import { compileClassicPdf } from "../../web/src/lib/latex";
import { storeGeneratedPdf, storeGeneratedPreviewAsset } from "../../web/src/lib/file-storage";
import { completeCvTimeToFirstCv } from "../../web/src/lib/cv-time-to-value";
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

      await createSvgPreviewAssets({
        pdfPath: result.pdfPath,
        workspaceId: renderJob.workspaceId,
        profileId: renderJob.profileId,
        documentId: renderJob.documentId
      }).catch((error) => {
        console.warn(`SVG preview generation skipped for ${renderJob.documentId}:`, error);
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

      await completeCvTimeToFirstCv(prisma, {
        workspaceId: renderJob.workspaceId,
        profileId: renderJob.profileId,
        documentId: renderJob.documentId,
        renderJobId: renderJob.id
      }).catch((error) => {
        console.warn(`Time-to-first-CV measurement skipped for ${renderJob.profileId}:`, error);
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

async function createSvgPreviewAssets({
  pdfPath,
  workspaceId,
  profileId,
  documentId
}: {
  pdfPath: string;
  workspaceId: string;
  profileId: string;
  documentId: string;
}) {
  const pageCount = await getPdfPageCount(pdfPath);
  if (pageCount < 1) return;

  const configuredConcurrency = Number.parseInt(process.env.CVSCHOLAR_CV_SVG_PREVIEW_CONCURRENCY || "2", 10);
  const renderConcurrency = Number.isFinite(configuredConcurrency) && configuredConcurrency > 0 ? configuredConcurrency : 2;
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "cv-svg-preview-"));
  const pageAssets: { page: number; assetId: string; filename: string }[] = [];

  try {
    await prisma.fileAsset.deleteMany({
      where: {
        documentId,
        kind: { in: ["generated_cv_svg_page", "generated_cv_svg_manifest"] }
      }
    });

    const pageNumbers = Array.from({ length: pageCount }, (_, index) => index + 1);
    for (let index = 0; index < pageNumbers.length; index += renderConcurrency) {
      const batch = pageNumbers.slice(index, index + renderConcurrency);
      const convertedPages = await Promise.all(batch.map((page) => convertPdfPageToSvg({ page, pdfPath, tempDir })));
      for (const { page, filename, bytes } of convertedPages) {
        const stored = await storeGeneratedPreviewAsset({
          bytes,
          workspaceId,
          documentId,
          filename,
          mimeType: "image/svg+xml"
        });
        const asset = await prisma.fileAsset.create({
          data: {
            workspaceId,
            profileId,
            documentId,
            kind: "generated_cv_svg_page",
            storageProvider: stored.storageProvider,
            bucket: stored.bucket,
            objectKey: stored.objectKey,
            localPath: stored.localPath,
            filename,
            mimeType: "image/svg+xml",
            byteSize: stored.byteSize,
            checksumSha256: stored.checksumSha256,
            isPublic: false
          }
        });
        pageAssets.push({ page, assetId: asset.id, filename });
      }
    }

    pageAssets.sort((a, b) => a.page - b.page);

    const manifest = Buffer.from(
      JSON.stringify({
        documentId,
        pageCount,
        renderedPages: pageAssets.length,
        pages: pageAssets
      }),
      "utf8"
    );
    const storedManifest = await storeGeneratedPreviewAsset({
      bytes: manifest,
      workspaceId,
      documentId,
      filename: "manifest.json",
      mimeType: "application/json"
    });
    await prisma.fileAsset.create({
      data: {
        workspaceId,
        profileId,
        documentId,
        kind: "generated_cv_svg_manifest",
        storageProvider: storedManifest.storageProvider,
        bucket: storedManifest.bucket,
        objectKey: storedManifest.objectKey,
        localPath: storedManifest.localPath,
        filename: "manifest.json",
        mimeType: "application/json",
        byteSize: storedManifest.byteSize,
        checksumSha256: storedManifest.checksumSha256,
        isPublic: false
      }
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function convertPdfPageToSvg({ page, pdfPath, tempDir }: { page: number; pdfPath: string; tempDir: string }) {
  const filename = `page-${String(page).padStart(3, "0")}.svg`;
  const outputPath = path.join(tempDir, filename);
  await runCommand("pdftocairo", ["-svg", "-f", String(page), "-l", String(page), pdfPath, outputPath], tempDir, 12_000);
  const bytes = await readFile(outputPath);
  return { page, filename, bytes };
}

async function getPdfPageCount(pdfPath: string) {
  const result = await runCommand("pdfinfo", [pdfPath], path.dirname(pdfPath), 8_000);
  const match = result.match(/^Pages:\s+(\d+)/m);
  return match ? Number.parseInt(match[1], 10) : 1;
}

function runCommand(command: string, args: string[], cwd: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, shell: false });
    let log = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${command} timed out.`));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      log += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      log += String(chunk);
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve(log);
      } else {
        reject(new Error(`${command} failed with code ${code}: ${log.slice(-2000)}`));
      }
    });
  });
}

async function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down PDF worker.`);
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
}
