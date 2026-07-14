import { Queue } from "bullmq";
import { getRedisConnectionOptions } from "./pdf-queue";

export const AGENT_ATTACHMENT_EXTRACTION_QUEUE = "cvscholar-agent-attachment-extraction";

export type AgentAttachmentExtractionPayload = {
  attachmentId: string;
  workspaceId: string;
  profileId: string;
  fileAssetId: string;
  checksumSha256: string;
};

let queue: Queue<AgentAttachmentExtractionPayload, void, string> | null = null;

export function getAgentAttachmentExtractionQueue() {
  if (!queue) {
    queue = new Queue<AgentAttachmentExtractionPayload, void, string>(AGENT_ATTACHMENT_EXTRACTION_QUEUE, {
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
