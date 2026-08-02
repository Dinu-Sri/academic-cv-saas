import { NextResponse } from "next/server";
import { readStoredAsset } from "@/lib/file-storage";
import {
  clearWebsiteProfileImage,
  isWebpBuffer,
  PROFILE_IMAGE_MAX_BYTES,
  saveWebsiteProfileImage
} from "@/lib/website/profile-image";
import { prisma } from "@/lib/prisma";
import { resolveRequestActor } from "@/lib/request-user";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";
import { maybeRepublishPublishedWebsite } from "@/lib/website/maybe-republish";
import { parseWebsiteConfig } from "@/lib/website/data-builder";
import { WEBSITE_PROFILE_IMAGE_KIND } from "@/lib/website/profile-image";

export async function GET() {
  const actor = await resolveRequestActor({ allowGuest: false });
  if (!actor || actor.isGuest) {
    return NextResponse.json({ error: "Please login." }, { status: 401 });
  }

  const { workspace, profile } = await getOrCreateWorkspaceForUser(actor.user);
  const website = await prisma.academicWebsite.findUnique({ where: { profileId: profile.id } });
  if (!website || website.workspaceId !== workspace.id) {
    return NextResponse.json({ error: "Website not found." }, { status: 404 });
  }

  const config = parseWebsiteConfig(website);
  const assetId = config.appearance.profileImageAssetId;
  if (!assetId || config.appearance.showProfileImage === false) {
    return NextResponse.json({ error: "No profile image." }, { status: 404 });
  }

  const asset = await prisma.fileAsset.findFirst({
    where: {
      id: assetId,
      workspaceId: workspace.id,
      kind: WEBSITE_PROFILE_IMAGE_KIND
    }
  });
  if (!asset) {
    return NextResponse.json({ error: "No profile image." }, { status: 404 });
  }

  try {
    const bytes = await readStoredAsset(asset);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return NextResponse.json({ error: "Image file missing." }, { status: 404 });
  }
}

export async function POST(request: Request) {
  const actor = await resolveRequestActor({ allowGuest: false });
  if (!actor || actor.isGuest) {
    return NextResponse.json({ error: "Please login." }, { status: 401 });
  }

  const { workspace, profile } = await getOrCreateWorkspaceForUser(actor.user);
  const website = await prisma.academicWebsite.findUnique({ where: { profileId: profile.id } });
  if (!website || website.workspaceId !== workspace.id) {
    return NextResponse.json({ error: "Create a website draft before uploading a photo." }, { status: 404 });
  }

  const form = await request.formData();
  const file = form.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a cropped image file." }, { status: 422 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!isWebpBuffer(bytes)) {
    return NextResponse.json({ error: "Only cropped WebP images are accepted." }, { status: 422 });
  }
  if (bytes.byteLength > PROFILE_IMAGE_MAX_BYTES) {
    return NextResponse.json({ error: "Image is too large. Use a tighter crop." }, { status: 422 });
  }

  const saved = await saveWebsiteProfileImage({
    workspaceId: workspace.id,
    profileId: profile.id,
    websiteId: website.id,
    username: website.username,
    bytes,
    userId: actor.user.id
  });

  if (!saved.ok) {
    return NextResponse.json({ error: saved.error }, { status: saved.status });
  }

  // Keep live site in sync when published.
  void maybeRepublishPublishedWebsite({
    workspaceId: workspace.id,
    profileId: profile.id,
    requestedBy: actor.user.id,
    reason: "Auto-updating live site after profile photo change."
  });

  return NextResponse.json({
    ok: true,
    assetId: saved.assetId,
    photoUrl: saved.photoUrl,
    byteSize: saved.byteSize
  });
}

export async function DELETE() {
  const actor = await resolveRequestActor({ allowGuest: false });
  if (!actor || actor.isGuest) {
    return NextResponse.json({ error: "Please login." }, { status: 401 });
  }

  const { workspace, profile } = await getOrCreateWorkspaceForUser(actor.user);
  const website = await prisma.academicWebsite.findUnique({ where: { profileId: profile.id } });
  if (!website || website.workspaceId !== workspace.id) {
    return NextResponse.json({ error: "Website not found." }, { status: 404 });
  }

  const cleared = await clearWebsiteProfileImage({
    workspaceId: workspace.id,
    profileId: profile.id,
    websiteId: website.id,
    userId: actor.user.id
  });

  if (!cleared.ok) {
    return NextResponse.json({ error: cleared.error }, { status: cleared.status });
  }

  void maybeRepublishPublishedWebsite({
    workspaceId: workspace.id,
    profileId: profile.id,
    requestedBy: actor.user.id,
    reason: "Auto-updating live site after profile photo removed."
  });

  return NextResponse.json({ ok: true, cleared: cleared.cleared });
}
