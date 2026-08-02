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

  await prisma.academicWebsite.update({
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
    }
  });

  if (previousAssetId && previousAssetId !== asset.id) {
    await deleteWebsiteProfileImageAsset(previousAssetId).catch(() => undefined);
  }

  return {
    ok: true as const,
    assetId: asset.id,
    photoUrl: profileImageOwnerUrl(Date.now()),
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

  await prisma.academicWebsite.update({
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
    }
  });

  await deleteWebsiteProfileImageAsset(previousAssetId).catch(() => undefined);
  return { ok: true as const, cleared: true as const };
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
