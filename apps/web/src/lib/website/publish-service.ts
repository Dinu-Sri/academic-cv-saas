import type { User } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";
import { websitePublishEnabled } from "./constants";
import { getWebsitePublishQueue } from "./publish-queue";
import { assessWebsiteReadiness, buildReadinessCounts } from "./readiness";
import { processWebsitePublishJob } from "./snapshot-builder";
import { ensureProfileEditorData } from "@/lib/profile-editor";

export async function requestWebsitePublishForUser(user: Pick<User, "id" | "name" | "email">) {
  if (!websitePublishEnabled()) {
    throw Object.assign(new Error("Website publishing is disabled."), { status: 503 });
  }

  const { workspace, profile } = await getOrCreateWorkspaceForUser(user);
  await ensureProfileEditorData(profile.id);

  const website = await prisma.academicWebsite.findUnique({ where: { profileId: profile.id } });
  if (!website || website.workspaceId !== workspace.id) {
    throw Object.assign(new Error("Create a website draft before publishing."), { status: 404 });
  }

  const entries = await prisma.profileSectionEntry.findMany({
    where: { profileId: profile.id, archivedAt: null },
    select: { sectionKey: true }
  });
  const readiness = assessWebsiteReadiness(profile, buildReadinessCounts(entries));
  if (!readiness.canPublish) {
    throw Object.assign(new Error(`Complete required profile details before publishing: ${readiness.missingRequired.join(", ")}.`), {
      status: 422
    });
  }

  const idempotencyKey = `publish:${website.id}:${website.version}:${Date.now()}`;
  const job = await prisma.websitePublishJob.create({
    data: {
      workspaceId: workspace.id,
      profileId: profile.id,
      websiteId: website.id,
      requestedBy: user.id,
      status: "queued",
      stage: "queued",
      message: "Publish queued.",
      idempotencyKey,
      expectedVersion: website.version
    }
  });

  const useWorker = process.env.CVSCHOLAR_WEBSITE_WORKER_ENABLED !== "0";
  if (useWorker) {
    try {
      await getWebsitePublishQueue().add(
        "publish-website",
        {
          jobId: job.id,
          workspaceId: workspace.id,
          profileId: profile.id,
          websiteId: website.id
        },
        { jobId: job.id }
      );
    } catch {
      // Fallback: process inline if queue is unavailable.
      await processWebsitePublishJob(job.id);
      return { jobId: job.id, status: "completed" as const, mode: "inline" as const };
    }
  } else {
    await processWebsitePublishJob(job.id);
    return { jobId: job.id, status: "completed" as const, mode: "inline" as const };
  }

  return { jobId: job.id, status: "queued" as const, mode: "worker" as const };
}

export async function getWebsitePublishJobForUser(user: Pick<User, "id" | "name" | "email">, jobId: string) {
  const { workspace, profile } = await getOrCreateWorkspaceForUser(user);
  const job = await prisma.websitePublishJob.findFirst({
    where: {
      id: jobId,
      workspaceId: workspace.id,
      profileId: profile.id
    }
  });
  if (!job) {
    throw Object.assign(new Error("Publish job not found."), { status: 404 });
  }
  return {
    id: job.id,
    status: job.status,
    stage: job.stage,
    message: job.message,
    error: job.error,
    snapshotId: job.snapshotId,
    createdAt: job.createdAt.toISOString(),
    finishedAt: job.finishedAt?.toISOString() ?? null
  };
}

export async function unpublishWebsiteForUser(user: Pick<User, "id" | "name" | "email">) {
  if (!websitePublishEnabled()) {
    throw Object.assign(new Error("Website publishing is disabled."), { status: 503 });
  }

  const { workspace, profile } = await getOrCreateWorkspaceForUser(user);
  const website = await prisma.academicWebsite.findUnique({ where: { profileId: profile.id } });
  if (!website || website.workspaceId !== workspace.id) {
    throw Object.assign(new Error("Website not found."), { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.websiteSnapshot.updateMany({
      where: { websiteId: website.id, status: "active" },
      data: { status: "retired", retiredAt: new Date() }
    });
    await tx.academicWebsite.update({
      where: { id: website.id },
      data: {
        status: "draft",
        currentSnapshotId: null,
        unpublishedAt: new Date()
      }
    });
    await tx.websiteRevision.create({
      data: {
        workspaceId: workspace.id,
        profileId: profile.id,
        websiteId: website.id,
        action: "unpublish",
        targetField: "status",
        beforeJson: { status: website.status },
        afterJson: { status: "draft" },
        createdBy: user.id
      }
    });
  });

  return { ok: true as const };
}

export async function restoreWebsiteSnapshotForUser(user: Pick<User, "id" | "name" | "email">, snapshotId: string) {
  if (!websitePublishEnabled()) {
    throw Object.assign(new Error("Website publishing is disabled."), { status: 503 });
  }

  const { workspace, profile } = await getOrCreateWorkspaceForUser(user);
  const website = await prisma.academicWebsite.findUnique({ where: { profileId: profile.id } });
  if (!website || website.workspaceId !== workspace.id) {
    throw Object.assign(new Error("Website not found."), { status: 404 });
  }

  const source = await prisma.websiteSnapshot.findFirst({
    where: { id: snapshotId, websiteId: website.id }
  });
  if (!source) {
    throw Object.assign(new Error("Snapshot not found."), { status: 404 });
  }

  const latest = await prisma.websiteSnapshot.findFirst({
    where: { websiteId: website.id },
    orderBy: { version: "desc" },
    select: { version: true }
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  const restored = await prisma.$transaction(async (tx) => {
    await tx.websiteSnapshot.updateMany({
      where: { websiteId: website.id, status: "active" },
      data: { status: "retired", retiredAt: new Date() }
    });

    const created = await tx.websiteSnapshot.create({
      data: {
        websiteId: website.id,
        version: nextVersion,
        templateKey: source.templateKey,
        templateVersion: source.templateVersion,
        snapshotJson: source.snapshotJson ?? {},
        sourceProfileVersion: source.sourceProfileVersion,
        sourceCvVersion: source.sourceCvVersion,
        checksumSha256: source.checksumSha256,
        status: "active",
        createdBy: user.id,
        publishedAt: new Date()
      }
    });

    await tx.academicWebsite.update({
      where: { id: website.id },
      data: {
        status: "published",
        currentSnapshotId: created.id,
        publishedAt: new Date(),
        unpublishedAt: null
      }
    });

    await tx.websiteRevision.create({
      data: {
        workspaceId: workspace.id,
        profileId: profile.id,
        websiteId: website.id,
        action: "restore_snapshot",
        targetField: "currentSnapshotId",
        beforeJson: { snapshotId: website.currentSnapshotId },
        afterJson: { snapshotId: created.id, restoredFrom: source.id },
        createdBy: user.id
      }
    });

    return created;
  });

  return { ok: true as const, snapshotId: restored.id, version: restored.version };
}

export async function listWebsiteSnapshotsForUser(user: Pick<User, "id" | "name" | "email">) {
  const { workspace, profile } = await getOrCreateWorkspaceForUser(user);
  const website = await prisma.academicWebsite.findUnique({ where: { profileId: profile.id } });
  if (!website || website.workspaceId !== workspace.id) {
    return [];
  }

  const snapshots = await prisma.websiteSnapshot.findMany({
    where: { websiteId: website.id },
    orderBy: { version: "desc" },
    take: 20
  });

  return snapshots.map((snapshot) => ({
    id: snapshot.id,
    version: snapshot.version,
    status: snapshot.status,
    publishedAt: snapshot.publishedAt.toISOString(),
    retiredAt: snapshot.retiredAt?.toISOString() ?? null,
    isCurrent: snapshot.id === website.currentSnapshotId
  }));
}
