import type { Prisma } from "@/generated/prisma/client";
import { deleteStoredAsset, storeWorkspaceFile } from "@/lib/file-storage";
import { prisma } from "@/lib/prisma";
import { parseWebsiteConfig } from "@/lib/website/data-builder";
import {
  PROFILE_IMAGE_MAX_BYTES,
  profileImageOwnerUrl,
  profileImagePublicUrl
} from "@/lib/website/profile-image-constants";

export const WEBSITE_PROFILE_IMAGE_KIND = "website_profile_image";
export {
  PROFILE_IMAGE_MAX_BYTES,
  PROFILE_IMAGE_OUTPUT_SIZE,
  profileImageOwnerUrl,
  profileImagePublicUrl
} from "@/lib/website/profile-image-constants";

const WEBP_RIFF = Buffer.from("RIFF");
const WEBP_WEBP = Buffer.from("WEBP");

export function isWebpBuffer(bytes: Buffer) {
  return (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).equals(WEBP_RIFF) &&
    bytes.subarray(8, 12).equals(WEBP_WEBP)
  );
}

export async function resolveWebsitePhotoUrl(input: {
  username: string;
  appearance: { profileImageAssetId?: string | null; showProfileImage?: boolean };
  /** Cache-buster (asset updatedAt or website version). */
  version?: string | number | null;
  mode: "public" | "owner";
}): Promise<string | undefined> {
  if (input.appearance.showProfileImage === false) return undefined;
  if (!input.appearance.profileImageAssetId) return undefined;

  const asset = await prisma.fileAsset.findFirst({
    where: {
      id: input.appearance.profileImageAssetId,
      kind: WEBSITE_PROFILE_IMAGE_KIND
    },
    select: { id: true }
  });
  if (!asset) return undefined;

  return input.mode === "public"
    ? profileImagePublicUrl(input.username, input.version ?? asset.id.slice(0, 8))
    : profileImageOwnerUrl(input.version ?? asset.id.slice(0, 8));
}

export async function saveWebsiteProfileImage(input: {
  workspaceId: string;
  profileId: string;
  websiteId: string;
  username: string;
  bytes: Buffer;
  userId: string;
}) {
  if (!isWebpBuffer(input.bytes)) {
    return { ok: false as const, error: "Upload a cropped WebP image only.", status: 422 };
  }
  if (input.bytes.byteLength > PROFILE_IMAGE_MAX_BYTES) {
    return { ok: false as const, error: "Image is too large after optimization. Try a tighter crop.", status: 422 };
  }

  const website = await prisma.academicWebsite.findFirst({
    where: { id: input.websiteId, workspaceId: input.workspaceId, profileId: input.profileId }
  });
  if (!website) {
    return { ok: false as const, error: "Website draft not found.", status: 404 };
  }

  const config = parseWebsiteConfig(website);
  const previousAssetId = config.appearance.profileImageAssetId || null;

  const stored = await storeWorkspaceFile({
    bytes: input.bytes,
    workspaceId: input.workspaceId,
    filename: "profile.webp",
    mimeType: "image/webp",
    prefix: "website-profile"
  });

  const asset = await prisma.fileAsset.create({
    data: {
      workspaceId: input.workspaceId,
      profileId: input.profileId,
      kind: WEBSITE_PROFILE_IMAGE_KIND,
      storageProvider: stored.storageProvider,
      bucket: stored.bucket,
      objectKey: stored.objectKey,
      localPath: stored.localPath,
      filename: "profile.webp",
      mimeType: "image/webp",
      byteSize: stored.byteSize,
      checksumSha256: stored.checksumSha256,
      isPublic: true
    }
  });

  const nextAppearance = {
    ...config.appearance,
    profileImageAssetId: asset.id,
    showProfileImage: true
  };

  const updated = await prisma.academicWebsite.update({
    where: { id: website.id },
    data: {
      appearanceJson: nextAppearance as unknown as Prisma.InputJsonValue,
      version: { increment: 1 },
      revisions: {
        create: {
          workspaceId: input.workspaceId,
          profileId: input.profileId,
          action: "update_profile_image",
          targetField: "appearance.profileImageAssetId",
          beforeJson: { profileImageAssetId: previousAssetId },
          afterJson: { profileImageAssetId: asset.id },
          createdBy: input.userId
        }
      }
    },
    select: { id: true, username: true, version: true, status: true, currentSnapshotId: true }
  });

  if (previousAssetId && previousAssetId !== asset.id) {
    await deleteWebsiteProfileImageAsset(previousAssetId).catch(() => undefined);
  }

  const publicPhotoUrl = profileImagePublicUrl(updated.username, updated.version);
  // Immediately patch the live snapshot so visitors see the new photo without waiting for a full republish.
  if (updated.status === "published" && updated.currentSnapshotId) {
    await patchActiveSnapshotPhotoUrl({
      snapshotId: updated.currentSnapshotId,
      photoUrl: publicPhotoUrl
    }).catch((error) => {
      console.error("[website/profile-image] snapshot photo patch failed", error);
    });
  }

  return {
    ok: true as const,
    assetId: asset.id,
    photoUrl: profileImageOwnerUrl(updated.version),
    publicPhotoUrl,
    websiteVersion: updated.version,
    byteSize: asset.byteSize
  };
}

export async function clearWebsiteProfileImage(input: {
  workspaceId: string;
  profileId: string;
  websiteId: string;
  userId: string;
}) {
  const website = await prisma.academicWebsite.findFirst({
    where: { id: input.websiteId, workspaceId: input.workspaceId, profileId: input.profileId }
  });
  if (!website) {
    return { ok: false as const, error: "Website draft not found.", status: 404 };
  }

  const config = parseWebsiteConfig(website);
  const previousAssetId = config.appearance.profileImageAssetId || null;
  if (!previousAssetId) {
    return { ok: true as const, cleared: false as const };
  }

  const nextAppearance = {
    ...config.appearance,
    profileImageAssetId: null,
    showProfileImage: true
  };

  const updated = await prisma.academicWebsite.update({
    where: { id: website.id },
    data: {
      appearanceJson: nextAppearance as unknown as Prisma.InputJsonValue,
      version: { increment: 1 },
      revisions: {
        create: {
          workspaceId: input.workspaceId,
          profileId: input.profileId,
          action: "clear_profile_image",
          targetField: "appearance.profileImageAssetId",
          beforeJson: { profileImageAssetId: previousAssetId },
          afterJson: { profileImageAssetId: null },
          createdBy: input.userId
        }
      }
    },
    select: { id: true, status: true, currentSnapshotId: true }
  });

  if (updated.status === "published" && updated.currentSnapshotId) {
    await patchActiveSnapshotPhotoUrl({
      snapshotId: updated.currentSnapshotId,
      photoUrl: undefined
    }).catch((error) => {
      console.error("[website/profile-image] snapshot photo clear failed", error);
    });
  }

  await deleteWebsiteProfileImageAsset(previousAssetId).catch(() => undefined);
  return { ok: true as const, cleared: true as const };
}

/**
 * Patch photo URLs inside the frozen published snapshot so the live site
 * reflects a new profile image immediately (without waiting for a full republish).
 */
async function patchActiveSnapshotPhotoUrl(input: {
  snapshotId: string;
  photoUrl: string | undefined;
}) {
  const snapshot = await prisma.websiteSnapshot.findUnique({
    where: { id: input.snapshotId },
    select: { id: true, snapshotJson: true, status: true }
  });
  if (!snapshot || snapshot.status !== "active") return;

  const raw = snapshot.snapshotJson;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
  const model = { ...(raw as Record<string, unknown>) };

  const identity =
    model.identity && typeof model.identity === "object" && !Array.isArray(model.identity)
      ? { ...(model.identity as Record<string, unknown>) }
      : null;
  if (identity) {
    if (input.photoUrl) identity.photoUrl = input.photoUrl;
    else delete identity.photoUrl;
    model.identity = identity;
  }

  // siteIr.identity.photoUrl (composition IR path)
  const siteIr =
    model.siteIr && typeof model.siteIr === "object" && !Array.isArray(model.siteIr)
      ? { ...(model.siteIr as Record<string, unknown>) }
      : null;
  if (siteIr) {
    const siteIdentity =
      siteIr.identity && typeof siteIr.identity === "object" && !Array.isArray(siteIr.identity)
        ? { ...(siteIr.identity as Record<string, unknown>) }
        : null;
    if (siteIdentity) {
      if (input.photoUrl) siteIdentity.photoUrl = input.photoUrl;
      else delete siteIdentity.photoUrl;
      siteIr.identity = siteIdentity;
    }

    // identity_hero blocks embedded in routes
    if (Array.isArray(siteIr.routes)) {
      siteIr.routes = siteIr.routes.map((route) => {
        if (!route || typeof route !== "object" || Array.isArray(route)) return route;
        const r = { ...(route as Record<string, unknown>) };
        if (!Array.isArray(r.blocks)) return r;
        r.blocks = r.blocks.map((block) => {
          if (!block || typeof block !== "object" || Array.isArray(block)) return block;
          const b = { ...(block as Record<string, unknown>) };
          if (b.type !== "identity_hero") return b;
          const props =
            b.props && typeof b.props === "object" && !Array.isArray(b.props)
              ? { ...(b.props as Record<string, unknown>) }
              : null;
          if (!props) return b;
          const blockIdentity =
            props.identity && typeof props.identity === "object" && !Array.isArray(props.identity)
              ? { ...(props.identity as Record<string, unknown>) }
              : null;
          if (blockIdentity) {
            if (input.photoUrl) {
              blockIdentity.photoUrl = input.photoUrl;
              props.heroMode = "with_photo";
            } else {
              delete blockIdentity.photoUrl;
              if (props.heroMode === "with_photo") props.heroMode = "identity_only";
            }
            props.identity = blockIdentity;
          }
          b.props = props;
          return b;
        });
        return r;
      });
    }
    model.siteIr = siteIr;
  }

  await prisma.websiteSnapshot.update({
    where: { id: snapshot.id },
    data: { snapshotJson: model as unknown as Prisma.InputJsonValue }
  });
}

export async function loadWebsiteProfileImageAsset(websiteId: string) {
  const website = await prisma.academicWebsite.findUnique({
    where: { id: websiteId },
    select: {
      id: true,
      appearanceJson: true,
      workspaceId: true,
      profileId: true,
      username: true,
      status: true,
      pageContentJson: true,
      enabledPagesJson: true,
      navigationJson: true,
      sectionVisibilityJson: true,
      fieldVisibilityJson: true,
      featuredContentJson: true,
      seoJson: true,
      headlineOverride: true,
      templateKey: true,
      contactFormEnabled: true,
      searchIndexingEnabled: true,
      sourceCvDocumentId: true
    }
  });
  if (!website) return null;
  const config = parseWebsiteConfig(website);
  if (!config.appearance.profileImageAssetId || config.appearance.showProfileImage === false) {
    return null;
  }
  const asset = await prisma.fileAsset.findFirst({
    where: {
      id: config.appearance.profileImageAssetId,
      kind: WEBSITE_PROFILE_IMAGE_KIND,
      workspaceId: website.workspaceId
    }
  });
  return asset ? { website, asset } : null;
}

async function deleteWebsiteProfileImageAsset(assetId: string) {
  const asset = await prisma.fileAsset.findUnique({ where: { id: assetId } });
  if (!asset) return;
  await deleteStoredAsset(asset);
  await prisma.fileAsset.delete({ where: { id: asset.id } }).catch(() => undefined);
}
