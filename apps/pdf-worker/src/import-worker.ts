import "dotenv/config";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { Worker } from "bullmq";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../web/src/generated/prisma/client";
import { deepSeekJson } from "../../web/src/lib/ai/deepseek";
import { extractImagePagesContent } from "../../web/src/lib/ai/document-extraction";
import { normalizeImportDraft, summarizeDraft } from "../../web/src/lib/cv-import-core";
import { CV_IMPORT_QUEUE, type CvImportQueuePayload } from "../../web/src/lib/cv-import-queue";
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

const concurrency = Number.parseInt(process.env.CVSCHOLAR_CV_IMPORT_WORKER_CONCURRENCY || "1", 10);

const worker = new Worker<CvImportQueuePayload>(
  CV_IMPORT_QUEUE,
  async (queueJob) => {
    const payload = queueJob.data;
    const importJob = await prisma.cvImportJob.findUnique({
      where: { id: payload.jobId },
      include: { fileAsset: true }
    });

    if (!importJob?.fileAsset) {
      throw new Error(`CV import job ${payload.jobId} or its PDF file was not found.`);
    }

    await prisma.cvImportJob.update({
      where: { id: importJob.id },
      data: {
        status: "processing",
        stage: "reading_pdf",
        message: "Reading the old CV PDF.",
        startedAt: new Date()
      }
    });

    try {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error("OpenAI extraction is not configured. Set OPENAI_API_KEY before importing old CVs.");
      }

      if (!process.env.DEEPSEEK_API_KEY) {
        throw new Error("DeepSeek is not configured. Set DEEPSEEK_API_KEY before importing old CVs.");
      }

      const pdfBytes = await readStoredAsset(importJob.fileAsset);
      const pageImages = await renderPdfPages(pdfBytes, importJob.id);

      await prisma.cvImportJob.update({
        where: { id: importJob.id },
        data: {
          stage: "mapping_fields",
          message: "Mapping academic CV fields."
        }
      });

      const extracted = await extractCvContentWithOpenAi(pageImages);
      const rawDraft = await mapExtractedCvWithDeepSeek(extracted);
      const draft = normalizeImportDraft(rawDraft);
      const stats = summarizeDraft(draft);

      if (stats.totalEntries === 0 && stats.personalFields === 0) {
        throw new Error("No usable CV details were found in this PDF.");
      }

      await prisma.cvImportJob.update({
        where: { id: importJob.id },
        data: {
          status: "ready",
          stage: "ready_to_review",
          message: "Import ready to review.",
          draftJson: JSON.parse(JSON.stringify(draft)),
          statsJson: stats,
          warnings: draft.warnings,
          error: "",
          finishedAt: new Date()
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Old CV import failed.";
      await prisma.cvImportJob.update({
        where: { id: importJob.id },
        data: {
          status: "failed",
          stage: "failed",
          message,
          error: message,
          failedAt: new Date()
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
  console.log(`CV import completed: ${job.id}`);
});

worker.on("failed", (job, error) => {
  console.error(`CV import failed: ${job?.id ?? "unknown"}`, error);
});

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

async function renderPdfPages(pdfBytes: Buffer, jobId: string) {
  const pageLimit = Math.max(1, Math.min(20, Number.parseInt(process.env.CVSCHOLAR_CV_IMPORT_PAGE_LIMIT || "10", 10)));
  const tempDir = path.join(os.tmpdir(), `cv-import-${jobId}`);
  const inputPath = path.join(tempDir, "input.pdf");
  const prefix = path.join(tempDir, "page");

  await mkdir(tempDir, { recursive: true });
  await writeFile(inputPath, pdfBytes);

  try {
    await runCommand("pdftoppm", ["-jpeg", "-r", "130", "-f", "1", "-l", String(pageLimit), inputPath, prefix]);
    const files = (await readdir(tempDir)).filter((file) => file.endsWith(".jpg")).sort();
    if (files.length === 0) {
      throw new Error("The PDF could not be converted into readable pages.");
    }

    return Promise.all(files.map((file) => readFile(path.join(tempDir, file))));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function extractCvContentWithOpenAi(pageImages: Buffer[]) {
  const timeoutMs = Math.max(15000, Number.parseInt(process.env.CVSCHOLAR_CV_IMPORT_TIMEOUT_MS || "90000", 10));

  return extractImagePagesContent({
    pageImages,
    timeoutMs,
    prompt: [
      "Extract only visible academic CV content from these rendered page images.",
      "Return JSON only with keys: extractedText, facts, warnings.",
      "Preserve original wording, dates, publication titles, authors, institutions, roles, links, and section headings.",
      "Do not rewrite, categorize deeply, evaluate, infer missing facts, or create final app fields."
    ].join(" ")
  });
}

async function mapExtractedCvWithDeepSeek(extracted: { extractedText: string; facts: Record<string, unknown> }) {
  const timeoutMs = Math.max(15000, Number.parseInt(process.env.CVSCHOLAR_CV_IMPORT_TIMEOUT_MS || "90000", 10));

  return deepSeekJson<unknown>({
    timeoutMs,
    messages: [
      {
        role: "system",
        content:
          "You map extracted academic CV text into structured JSON for a CV editor. Use only provided extracted content. Return JSON only. Do not invent missing information."
      },
      {
        role: "user",
        content: JSON.stringify({
          extraction: extracted,
          requiredShape:
            "Return {personal, sections, unmapped, warnings}. personal may include displayName, headline, affiliation, location, email, websiteUrl, googleScholarUrl, orcidUrl, linkedinUrl, bio. sections must be keyed by education, languages, experience, teaching, awards, memberships, grants, publications, references, declaration, research_interests, academic_appointments, research_experience, projects, conferences, supervision, patents, invited_talks, academic_service, editorial, certifications, skills. Each section value must be an array of objects using obvious field names from the CV. Preserve dates, publications, names, institutions, and links exactly where possible.",
          rules: [
            "Read multi-column content in natural human order.",
            "Keep date ranges attached to the correct entry.",
            "Leave unclear fields empty.",
            "Put content in unmapped only when no canonical section fits.",
            "Warnings should identify low-confidence sections or unreadable areas."
          ]
        })
      }
    ]
  });
}

function runCommand(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr.trim() || `${command} failed with exit code ${code}.`));
      }
    });
  });
}

async function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down CV import worker.`);
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
}
