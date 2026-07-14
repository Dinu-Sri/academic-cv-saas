import "dotenv/config";
import { Worker } from "bullmq";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../web/src/generated/prisma/client";
import { AGENT_ATTACHMENT_EXTRACTION_QUEUE, type AgentAttachmentExtractionPayload } from "../../web/src/lib/agent-attachment-queue";
import { extractDocumentContent, openAiExtractionIsConfigured } from "../../web/src/lib/ai/document-extraction";
import { readStoredAsset } from "../../web/src/lib/file-storage";
import { getRedisConnectionOptions } from "../../web/src/lib/pdf-queue";

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

const concurrency = Math.max(1, Number.parseInt(process.env.CVSCHOLAR_ATTACHMENT_EXTRACT_WORKER_CONCURRENCY || "1", 10));

const worker = new Worker<AgentAttachmentExtractionPayload>(
  AGENT_ATTACHMENT_EXTRACTION_QUEUE,
  async (queueJob) => {
    const payload = queueJob.data;
    const attachment = await prisma.cvAgentAttachment.findFirst({
      where: {
        id: payload.attachmentId,
        workspaceId: payload.workspaceId,
        profileId: payload.profileId,
        fileAssetId: payload.fileAssetId
      },
      include: { fileAsset: true }
    });

    if (!attachment?.fileAsset) {
      throw new Error(`Agent attachment ${payload.attachmentId} or its file was not found.`);
    }

    const cached = await prisma.cvAgentAttachment.findFirst({
      where: {
        id: { not: attachment.id },
        profileId: attachment.profileId,
        status: "extracted",
        fileAsset: {
          checksumSha256: payload.checksumSha256
        }
      },
      orderBy: { createdAt: "desc" }
    });

    if (cached) {
      await prisma.cvAgentAttachment.update({
        where: { id: attachment.id },
        data: {
          status: "extracted",
          extractedText: cached.extractedText,
          extractedFactsJson: JSON.parse(JSON.stringify(cached.extractedFactsJson ?? {})),
          error: ""
        }
      });
      return;
    }

    await prisma.cvAgentAttachment.update({
      where: { id: attachment.id },
      data: {
        status: "processing",
        extractedFactsJson: {
          filename: attachment.filename,
          mimeType: attachment.fileType,
          extractionStatus: "processing"
        }
      }
    });

    if (!openAiExtractionIsConfigured()) {
      await prisma.cvAgentAttachment.update({
        where: { id: attachment.id },
        data: {
          status: "stored",
          extractedFactsJson: {
            filename: attachment.filename,
            mimeType: attachment.fileType,
            extractionStatus: "openai_unconfigured",
            warning: "Stored for AI chat, but OPENAI_API_KEY is required to extract PDF/image content."
          }
        }
      });
      return;
    }

    try {
      const bytes = await readStoredAsset(attachment.fileAsset);
      const extracted = await extractDocumentContent({
        bytes,
        filename: attachment.filename,
        mimeType: attachment.fileType,
        timeoutMs: Number.parseInt(process.env.CVSCHOLAR_ATTACHMENT_EXTRACT_TIMEOUT_MS || "90000", 10)
      });

      await prisma.cvAgentAttachment.update({
        where: { id: attachment.id },
        data: {
          status: "extracted",
          extractedText: extracted.extractedText.slice(0, 60000),
          extractedFactsJson: {
            ...extracted.facts,
            filename: attachment.filename,
            mimeType: attachment.fileType,
            extractionProvider: "openai",
            extractionModel: process.env.CVSCHOLAR_DOCUMENT_EXTRACT_MODEL || process.env.CVSCHOLAR_CV_IMPORT_MODEL || "gpt-5.4-mini"
          },
          error: ""
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Attachment extraction failed.";
      await prisma.cvAgentAttachment.update({
        where: { id: attachment.id },
        data: {
          status: "extract_failed",
          error: message,
          extractedFactsJson: {
            filename: attachment.filename,
            mimeType: attachment.fileType,
            extractionStatus: "failed",
            warning: message
          }
        }
      });
      throw error;
    }
  },
  {
    connection: getRedisConnectionOptions(),
    concurrency
  }
);

worker.on("completed", (job) => {
  console.log(`Agent attachment extraction completed: ${job.id}`);
});

worker.on("failed", (job, error) => {
  console.error(`Agent attachment extraction failed: ${job?.id ?? "unknown"}`, error);
});

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

async function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down agent attachment worker.`);
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
}
