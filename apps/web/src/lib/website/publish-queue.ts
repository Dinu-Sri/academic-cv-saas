import { Queue, type ConnectionOptions } from "bullmq";
import { getRedisConnectionOptions } from "../pdf-queue";

export const WEBSITE_PUBLISH_QUEUE = "cvscholar-website-publish";

export type WebsitePublishQueuePayload = {
  jobId: string;
  workspaceId: string;
  profileId: string;
  websiteId: string;
};

let queue: Queue<WebsitePublishQueuePayload, void, string> | null = null;

export function getWebsitePublishQueue() {
  if (!queue) {
    queue = new Queue<WebsitePublishQueuePayload, void, string>(WEBSITE_PUBLISH_QUEUE, {
      connection: getRedisConnectionOptions() as ConnectionOptions,
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: "exponential",
          delay: 4000
        },
        removeOnComplete: 100,
        removeOnFail: 200
      }
    });
  }

  return queue;
}
