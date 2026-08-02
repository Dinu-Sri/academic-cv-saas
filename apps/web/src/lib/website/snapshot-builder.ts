import crypto from "node:crypto";
import type { Prisma } from "../../generated/prisma/client";
import { prisma } from "../prisma";
import { ensureProfileEditorData } from "../profile-editor";
import { buildWebsitePreviewModel } from "./data-builder";
import { assessWebsiteReadiness, buildReadinessCounts } from "./readiness";
import { WEBSITE_TEMPLATE_KEY } from "./constants";

export type WebsiteSnapshotModel = ReturnType<typeof buildWebsitePreviewModel> & {
  snapshotVersion: number;
  publishedAt: string;
  sourceProfileVersion: number;
  sourceCvVersion: number | null;
};

export async function buildWebsiteSnapshotPayload(websiteId: string) {
  const website = await prisma.academicWebsite.findUnique({
    where: { id: websiteId },
    include: {
      profile: true,
      sourceCvDocument: {
        select: { id: true, version: true, title: true }
      }
    }
  });

  if (!website) {
    throw new Error("Website was not found.");
  }

  await ensureProfileEditorData(website.profileId);
  const entries = await prisma.profileSectionEntry.findMany({
    where: { profileId: website.profileId, archivedAt: null },
    orderBy: { entryOrder: "asc" },
    select: { id: true, sectionKey: true, data: true }
  });

  const readiness = assessWebsiteReadiness(website.profile, buildReadinessCounts(entries));

  if (!readiness.canPublish) {
    throw new Error(`Website is not ready to publish: missing ${readiness.missingRequired.join(", ")}.`);
  }

  const { resolveWebsitePhotoUrl } = await import("@/lib/website/profile-image");
  const { parseWebsiteConfig } = await import("@/lib/website/data-builder");
  const appearance = parseWebsiteConfig(website).appearance;
  const photoUrl = await resolveWebsitePhotoUrl({
    username: website.username,
    appearance,
    version: website.version,
    mode: "public"
  });

  const model = buildWebsitePreviewModel({
    website,
    profile: website.profile,
    entries: entries.map((entry) => ({
      id: entry.id,
      sectionKey: entry.sectionKey,
      data: (entry.data ?? {}) as Record<string, string>
    })),
    photoUrl
  });

  // Public nav hrefs are subdomain-relative (/, /about, …). Middleware maps
  // username.rootDomain/* → internal /u/username/* for Next.js routing.
  const publicModel: WebsiteSnapshotModel = {
    ...model,
    publicUrl: `https://${website.username}.${process.env.NEXT_PUBLIC_WEBSITE_ROOT_DOMAIN || process.env.CVSCHOLAR_WEBSITE_ROOT_DOMAIN || "cvscholar.com"}`,
    pages: model.pages.map((page) => ({
      ...page,
      href: page.key === "home" ? "/" : `/${page.key}`
    })),
    snapshotVersion: 0,
    publishedAt: new Date().toISOString(),
    sourceProfileVersion: website.profile.version,
    sourceCvVersion: website.sourceCvDocument?.version ?? null
  };

  const checksumSha256 = crypto.createHash("sha256").update(JSON.stringify(publicModel)).digest("hex");

  return {
    website,
    publicModel,
    checksumSha256,
    templateKey: website.templateKey || WEBSITE_TEMPLATE_KEY,
    sourceProfileVersion: website.profile.version,
    sourceCvVersion: website.sourceCvDocument?.version ?? null
  };
}

export async function processWebsitePublishJob(jobId: string) {
  const job = await prisma.websitePublishJob.findUnique({
    where: { id: jobId },
    include: { website: true }
  });

  if (!job) {
    throw new Error(`Website publish job ${jobId} was not found.`);
  }

  if (job.status === "completed") {
    return { status: "completed" as const, snapshotId: job.snapshotId };
  }

  await prisma.websitePublishJob.update({
    where: { id: job.id },
    data: {
      status: "processing",
      stage: "building_snapshot",
      message: "Building published snapshot.",
      attempts: { increment: 1 },
      startedAt: job.startedAt ?? new Date(),
      error: ""
    }
  });

  try {
    if (job.website.version !== job.expectedVersion) {
      throw new Error("Website draft changed while publishing. Refresh and publish again.");
    }

    const built = await buildWebsiteSnapshotPayload(job.websiteId);

    await prisma.websitePublishJob.update({
      where: { id: job.id },
      data: {
        stage: "saving_snapshot",
        message: "Saving immutable snapshot."
      }
    });

    const latest = await prisma.websiteSnapshot.findFirst({
      where: { websiteId: job.websiteId },
      orderBy: { version: "desc" },
      select: { version: true }
    });
    const nextVersion = (latest?.version ?? 0) + 1;
    const snapshotJson = {
      ...built.publicModel,
      snapshotVersion: nextVersion
    } as unknown as Prisma.InputJsonValue;

    const snapshot = await prisma.$transaction(async (tx) => {
      await tx.websiteSnapshot.updateMany({
        where: { websiteId: job.websiteId, status: "active" },
        data: {
          status: "retired",
          retiredAt: new Date()
        }
      });

      const created = await tx.websiteSnapshot.create({
        data: {
          websiteId: job.websiteId,
          version: nextVersion,
          templateKey: built.templateKey,
          templateVersion: "1.0.0",
          snapshotJson,
          sourceProfileVersion: built.sourceProfileVersion,
          sourceCvVersion: built.sourceCvVersion,
          checksumSha256: built.checksumSha256,
          status: "active",
          createdBy: job.requestedBy,
          publishedAt: new Date()
        }
      });

      await tx.academicWebsite.update({
        where: { id: job.websiteId },
        data: {
          status: "published",
          currentSnapshotId: created.id,
          publishedAt: new Date(),
          unpublishedAt: null
        }
      });

      await tx.websitePublishJob.update({
        where: { id: job.id },
        data: {
          status: "completed",
          stage: "completed",
          message: "Website published.",
          snapshotId: created.id,
          finishedAt: new Date()
        }
      });

      return created;
    });

    return { status: "completed" as const, snapshotId: snapshot.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Website publish failed.";
    await prisma.websitePublishJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        stage: "failed",
        message: "Publish failed.",
        error: message,
        failedAt: new Date(),
        finishedAt: new Date()
      }
    });
    throw error;
  }
}

export async function getActivePublishedSnapshot(username: string) {
  const website = await prisma.academicWebsite.findFirst({
    where: {
      username: username.toLowerCase(),
      status: "published",
      archivedAt: null,
      blockedAt: null
    },
    select: {
      id: true,
      workspaceId: true,
      username: true,
      status: true,
      currentSnapshotId: true,
      searchIndexingEnabled: true,
      contactFormEnabled: true,
      blockedAt: true
    }
  });

  if (!website) return null;

  const snapshot = website.currentSnapshotId
    ? await prisma.websiteSnapshot.findFirst({
        where: {
          id: website.currentSnapshotId,
          websiteId: website.id,
          status: "active"
        }
      })
    : await prisma.websiteSnapshot.findFirst({
        where: { websiteId: website.id, status: "active" },
        orderBy: { publishedAt: "desc" }
      });

  if (!snapshot) return null;
  return { website, snapshot };
}
