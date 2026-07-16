import { prisma } from "@/lib/prisma";
import { getWebsitePublishQueue } from "./publish-queue";
import { processWebsitePublishJob } from "./snapshot-builder";
import { captureWebsiteException } from "@/lib/sentry";

export async function listWebsitesForAdmin(limit = 40) {
  const websites = await prisma.academicWebsite.findMany({
    orderBy: { updatedAt: "desc" },
    take: Math.min(100, Math.max(1, limit)),
    include: {
      profile: { select: { id: true, displayName: true, email: true } },
      workspace: { select: { id: true, name: true, slug: true } },
      _count: {
        select: {
          snapshots: true,
          publishJobs: true,
          contactMessages: true
        }
      }
    }
  });

  return websites.map((website) => ({
    id: website.id,
    username: website.username,
    status: website.status,
    version: website.version,
    publicPath: `/u/${website.username}`,
    searchIndexingEnabled: website.searchIndexingEnabled,
    contactFormEnabled: website.contactFormEnabled,
    blockedAt: website.blockedAt?.toISOString() ?? null,
    blockedReason: website.blockedReason || "",
    publishedAt: website.publishedAt?.toISOString() ?? null,
    unpublishedAt: website.unpublishedAt?.toISOString() ?? null,
    updatedAt: website.updatedAt.toISOString(),
    profile: website.profile,
    workspace: website.workspace,
    counts: website._count
  }));
}

export async function getWebsiteOpsDashboard() {
  const [total, published, draft, blocked, failedJobs, unreadMessages, recentJobs, snapshots] = await Promise.all([
    prisma.academicWebsite.count(),
    prisma.academicWebsite.count({ where: { status: "published", archivedAt: null } }),
    prisma.academicWebsite.count({ where: { status: "draft", archivedAt: null } }),
    prisma.academicWebsite.count({ where: { blockedAt: { not: null } } }),
    prisma.websitePublishJob.count({ where: { status: "failed" } }),
    prisma.websiteContactMessage.count({ where: { status: "unread", archivedAt: null } }),
    prisma.websitePublishJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        website: { select: { username: true, status: true } }
      }
    }),
    prisma.websiteSnapshot.findMany({
      orderBy: { publishedAt: "desc" },
      take: 20,
      include: {
        website: { select: { username: true } }
      }
    })
  ]);

  return {
    counts: {
      total,
      published,
      draft,
      blocked,
      failedJobs,
      unreadMessages
    },
    recentJobs: recentJobs.map((job) => ({
      id: job.id,
      websiteId: job.websiteId,
      username: job.website.username,
      websiteStatus: job.website.status,
      status: job.status,
      stage: job.stage,
      message: job.message,
      error: job.error,
      attempts: job.attempts,
      createdAt: job.createdAt.toISOString(),
      finishedAt: job.finishedAt?.toISOString() ?? null
    })),
    recentSnapshots: snapshots.map((snapshot) => ({
      id: snapshot.id,
      websiteId: snapshot.websiteId,
      username: snapshot.website.username,
      version: snapshot.version,
      status: snapshot.status,
      publishedAt: snapshot.publishedAt.toISOString(),
      retiredAt: snapshot.retiredAt?.toISOString() ?? null
    }))
  };
}

export async function blockWebsiteForAdmin(websiteId: string, reason: string, adminEmail: string) {
  const website = await prisma.academicWebsite.findUnique({ where: { id: websiteId } });
  if (!website) throw Object.assign(new Error("Website not found."), { status: 404 });

  const blockedReason = reason.trim().slice(0, 500) || "Blocked by admin";
  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.academicWebsite.update({
      where: { id: website.id },
      data: {
        blockedAt: new Date(),
        blockedReason,
        // Keep published snapshots but public loader already filters blockedAt.
        status: website.status === "published" ? "published" : website.status
      }
    });
    await tx.websiteRevision.create({
      data: {
        workspaceId: website.workspaceId,
        profileId: website.profileId,
        websiteId: website.id,
        action: "admin_block",
        targetField: "blockedAt",
        beforeJson: { blockedAt: website.blockedAt, blockedReason: website.blockedReason },
        afterJson: { blockedAt: next.blockedAt, blockedReason, adminEmail },
        createdBy: adminEmail
      }
    });
    return next;
  });

  return {
    id: updated.id,
    username: updated.username,
    blockedAt: updated.blockedAt?.toISOString() ?? null,
    blockedReason: updated.blockedReason
  };
}

export async function unblockWebsiteForAdmin(websiteId: string, adminEmail: string) {
  const website = await prisma.academicWebsite.findUnique({ where: { id: websiteId } });
  if (!website) throw Object.assign(new Error("Website not found."), { status: 404 });

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.academicWebsite.update({
      where: { id: website.id },
      data: {
        blockedAt: null,
        blockedReason: ""
      }
    });
    await tx.websiteRevision.create({
      data: {
        workspaceId: website.workspaceId,
        profileId: website.profileId,
        websiteId: website.id,
        action: "admin_unblock",
        targetField: "blockedAt",
        beforeJson: { blockedAt: website.blockedAt, blockedReason: website.blockedReason },
        afterJson: { blockedAt: null, blockedReason: "", adminEmail },
        createdBy: adminEmail
      }
    });
    return next;
  });

  return {
    id: updated.id,
    username: updated.username,
    blockedAt: null,
    blockedReason: ""
  };
}

export async function retryWebsitePublishJobForAdmin(jobId: string, adminEmail: string) {
  const job = await prisma.websitePublishJob.findUnique({
    where: { id: jobId },
    include: { website: true }
  });
  if (!job) throw Object.assign(new Error("Publish job not found."), { status: 404 });
  if (job.website.blockedAt) {
    throw Object.assign(new Error("Website is blocked and cannot be republished."), { status: 423 });
  }

  const idempotencyKey = `retry:${job.websiteId}:${job.website.version}:${Date.now()}`;
  const next = await prisma.websitePublishJob.create({
    data: {
      workspaceId: job.workspaceId,
      profileId: job.profileId,
      websiteId: job.websiteId,
      requestedBy: adminEmail,
      status: "queued",
      stage: "queued",
      message: `Retry of failed job ${job.id} by admin.`,
      idempotencyKey,
      expectedVersion: job.website.version,
      attempts: 0
    }
  });

  await prisma.websiteRevision.create({
    data: {
      workspaceId: job.workspaceId,
      profileId: job.profileId,
      websiteId: job.websiteId,
      action: "admin_retry_publish",
      targetField: "publishJob",
      beforeJson: { failedJobId: job.id, status: job.status },
      afterJson: { newJobId: next.id },
      createdBy: adminEmail
    }
  });

  const useWorker = process.env.CVSCHOLAR_WEBSITE_WORKER_ENABLED !== "0";
  if (useWorker) {
    try {
      await getWebsitePublishQueue().add(
        "publish-website",
        {
          jobId: next.id,
          workspaceId: next.workspaceId,
          profileId: next.profileId,
          websiteId: next.websiteId
        },
        { jobId: next.id }
      );
      return { jobId: next.id, status: "queued" as const, mode: "worker" as const };
    } catch (error) {
      await captureWebsiteException(error, { tags: { area: "admin_retry_queue" } });
      await processWebsitePublishJob(next.id);
      return { jobId: next.id, status: "completed" as const, mode: "inline" as const };
    }
  }

  await processWebsitePublishJob(next.id);
  return { jobId: next.id, status: "completed" as const, mode: "inline" as const };
}

export async function listWebsiteSnapshotsForAdmin(websiteId: string) {
  const website = await prisma.academicWebsite.findUnique({
    where: { id: websiteId },
    select: { id: true, username: true }
  });
  if (!website) throw Object.assign(new Error("Website not found."), { status: 404 });

  const snapshots = await prisma.websiteSnapshot.findMany({
    where: { websiteId },
    orderBy: { version: "desc" },
    take: 30
  });

  return {
    website,
    snapshots: snapshots.map((snapshot) => ({
      id: snapshot.id,
      version: snapshot.version,
      status: snapshot.status,
      templateKey: snapshot.templateKey,
      checksumSha256: snapshot.checksumSha256,
      publishedAt: snapshot.publishedAt.toISOString(),
      retiredAt: snapshot.retiredAt?.toISOString() ?? null
    }))
  };
}
