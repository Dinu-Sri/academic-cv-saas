import { Queue } from "bullmq";
import { getRedisConnectionOptions } from "./pdf-queue";

export const CV_IMPORT_QUEUE = "cvscholar-cv-import";

export type CvImportQueuePayload = {
  jobId: string;
  workspaceId: string;
  profileId: string;
  fileAssetId: string;
};

let queue: Queue<CvImportQueuePayload, void, string> | null = null;

export function getCvImportQueue() {
  if (!queue) {
    queue = new Queue<CvImportQueuePayload, void, string>(CV_IMPORT_QUEUE, {
      connection: getRedisConnectionOptions(),
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: 100,
        removeOnFail: 200
      }
    });
  }

  return queue;
}
