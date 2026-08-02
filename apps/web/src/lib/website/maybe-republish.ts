/**
 * When a published academic website exists for the profile, queue a silent republish
 * so Generate My CV / profile updates flow to the live site without a manual Publish click.
 * Never throws — CV compile must not fail if website republish fails.
 */

import { prisma } from "@/lib/prisma";
import { websitePublishEnabled } from "@/lib/website/constants";
import { getWebsitePublishQueue } from "@/lib/website/publish-queue";
import { processWebsitePublishJob } from "@/lib/website/snapshot-builder";

export async function maybeRepublishPublishedWebsite(input: {
  workspaceId: string;
  profileId: string;
  requestedBy: string;
  reason?: string;
}) {
  if (!websitePublishEnabled()) {
    return { queued: false as const, reason: "disabled" as const };
  }

  try {
    const website = await prisma.academicWebsite.findFirst({
      where: {
        profileId: input.profileId,
        workspaceId: input.workspaceId,
        status: "published",
        archivedAt: null,
        blockedAt: null
      },
      select: { id: true, version: true, username: true }
    });

    if (!website) {
      return { queued: false as const, reason: "not_published" as const };
    }

    // Debounce: skip if a publish job is already queued/running for this site.
    // Also treat "processing" (in-process worker status) as inflight.
    const inflight = await prisma.websitePublishJob.findFirst({
      where: {
        websiteId: website.id,
        status: { in: ["queued", "running", "processing"] }
      },
      select: { id: true }
    });
    if (inflight) {
      return { queued: false as const, reason: "already_inflight" as const, jobId: inflight.id };
    }

    // Re-read version at job create time so photo/CV updates that just bumped version still match.
    const latest = await prisma.academicWebsite.findUnique({
      where: { id: website.id },
      select: { version: true, username: true }
    });
    if (!latest) {
      return { queued: false as const, reason: "not_published" as const };
    }

    const idempotencyKey = `auto-publish:${website.id}:${Date.now()}`;
    const job = await prisma.websitePublishJob.create({
      data: {
        workspaceId: input.workspaceId,
        profileId: input.profileId,
        websiteId: website.id,
        requestedBy: input.requestedBy,
        status: "queued",
        stage: "queued",
        message: input.reason || "Auto-updating live site after CV generate.",
        idempotencyKey,
        expectedVersion: latest.version
      }
    });

    const useWorker = process.env.CVSCHOLAR_WEBSITE_WORKER_ENABLED !== "0";
    if (useWorker) {
      try {
        await getWebsitePublishQueue().add(
          "publish-website",
          {
            jobId: job.id,
            workspaceId: input.workspaceId,
            profileId: input.profileId,
            websiteId: website.id
          },
          { jobId: job.id }
        );
        return { queued: true as const, mode: "worker" as const, jobId: job.id, username: website.username };
      } catch {
        await processWebsitePublishJob(job.id);
        return { queued: true as const, mode: "inline" as const, jobId: job.id, username: website.username };
      }
    }

    await processWebsitePublishJob(job.id);
    return { queued: true as const, mode: "inline" as const, jobId: job.id, username: website.username };
  } catch (error) {
    console.error("[website/maybe-republish]", error);
    return { queued: false as const, reason: "error" as const };
  }
}
