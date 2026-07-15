import "dotenv/config";
import { Worker, type ConnectionOptions } from "bullmq";
import * as agentService from "../../web/src/lib/cv-agent/service";

const AGENT_RUN_QUEUE = "cvscholar-agent-runs";

type AgentRunQueuePayload = {
  runId: string;
};

const databaseUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;

if (!databaseUrl) {
  throw new Error("Missing required environment variable: DATABASE_URL");
}

if (!redisUrl) {
  throw new Error("Missing required environment variable: REDIS_URL");
}

const concurrency = Number.parseInt(process.env.CVSCHOLAR_AGENT_WORKER_CONCURRENCY || "1", 10);

const worker = new Worker<AgentRunQueuePayload>(
  AGENT_RUN_QUEUE,
  async (queueJob) => {
    await agentService.processQueuedAgentRun(queueJob.data.runId);
  },
  {
    connection: redisConnectionOptions(redisUrl),
    concurrency: Number.isFinite(concurrency) && concurrency > 0 ? concurrency : 1
  }
);

worker.on("completed", (job) => {
  console.log(`Agent run ${job.data.runId} completed.`);
});

worker.on("failed", (job, error) => {
  console.error(`Agent run ${job?.data.runId ?? "unknown"} failed:`, error);
});

async function shutdown() {
  await worker.close();
  process.exit(0);
}

process.on("SIGTERM", () => {
  void shutdown();
});

process.on("SIGINT", () => {
  void shutdown();
});

function redisConnectionOptions(url: string): ConnectionOptions {
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
