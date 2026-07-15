import { Queue } from "bullmq";
import { getRedisConnectionOptions } from "@/lib/pdf-queue";

export const AGENT_RUN_QUEUE = "cvscholar-agent-runs";

export type AgentRunQueuePayload = {
  runId: string;
  workspaceId: string;
  profileId: string;
  sessionId: string;
  taskId: string;
  threadId: string;
  messageId: string;
};

let queue: Queue<AgentRunQueuePayload, void, string> | null = null;

export function getAgentRunQueue() {
  if (!queue) {
    queue = new Queue<AgentRunQueuePayload, void, string>(AGENT_RUN_QUEUE, {
      connection: getRedisConnectionOptions(),
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: "exponential",
          delay: 5000
        },
        removeOnComplete: 200,
        removeOnFail: 500
      }
    });
  }

  return queue;
}
