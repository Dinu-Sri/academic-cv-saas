import { Queue, type ConnectionOptions } from "bullmq";

export const PDF_RENDER_QUEUE = "cvscholar-pdf-render";

export type PdfRenderQueuePayload = {
  jobId: string;
  workspaceId: string;
  profileId: string;
  documentId: string;
};

let queue: Queue<PdfRenderQueuePayload, void, string> | null = null;

export function getRedisConnectionOptions(): ConnectionOptions {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("Missing required environment variable: REDIS_URL");
  }

  const parsed = new URL(url);
  const db = parsed.pathname ? Number.parseInt(parsed.pathname.replace("/", ""), 10) : 0;

  return {
    host: parsed.hostname,
    port: parsed.port ? Number.parseInt(parsed.port, 10) : 6379,
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    db: Number.isFinite(db) ? db : 0,
    maxRetriesPerRequest: null
  };
}

export function getPdfRenderQueue() {
  if (!queue) {
    queue = new Queue<PdfRenderQueuePayload, void, string>(PDF_RENDER_QUEUE, {
      connection: getRedisConnectionOptions(),
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: "exponential",
          delay: 5000
        },
        removeOnComplete: 100,
        removeOnFail: 200
      }
    });
  }

  return queue;
}
