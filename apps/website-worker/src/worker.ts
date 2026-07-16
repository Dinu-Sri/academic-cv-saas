import "dotenv/config";
import { Worker } from "bullmq";
import { getRedisConnectionOptions } from "../../web/src/lib/pdf-queue";
import { WEBSITE_PUBLISH_QUEUE, type WebsitePublishQueuePayload } from "../../web/src/lib/website/publish-queue";
import { processWebsitePublishJob } from "../../web/src/lib/website/snapshot-builder";

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error("Missing required environment variable: REDIS_URL");
}
if (!process.env.DATABASE_URL) {
  throw new Error("Missing required environment variable: DATABASE_URL");
}

const concurrency = Math.max(1, Number.parseInt(process.env.WEBSITE_PUBLISH_WORKER_CONCURRENCY || "1", 10));

const worker = new Worker<WebsitePublishQueuePayload>(
  WEBSITE_PUBLISH_QUEUE,
  async (queueJob) => {
    console.log(`Website publish job ${queueJob.data.jobId} started.`);
    await processWebsitePublishJob(queueJob.data.jobId);
    console.log(`Website publish job ${queueJob.data.jobId} completed.`);
  },
  {
    connection: getRedisConnectionOptions(),
    concurrency
  }
);

worker.on("failed", (job, error) => {
  console.error(`Website publish job ${job?.data.jobId ?? "unknown"} failed:`, error);
});

console.log(`Website publish worker listening on ${WEBSITE_PUBLISH_QUEUE} (concurrency=${concurrency}).`);
