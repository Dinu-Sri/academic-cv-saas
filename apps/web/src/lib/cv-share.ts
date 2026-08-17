import { createHash, randomBytes } from "node:crypto";
import { absoluteUrl } from "@/lib/content/site-url";
import { prisma } from "@/lib/prisma";

function slugifyName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function cvSharePublicUrl(slug: string) {
  return absoluteUrl(`/s/${encodeURIComponent(slug)}`);
}

export function cvSharePdfUrl(slug: string) {
  return absoluteUrl(`/s/${encodeURIComponent(slug)}/pdf`);
}

async function uniqueSlug(base: string) {
  const seed = base || "academic-cv";
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const suffix =
      attempt === 0
        ? randomBytes(2).toString("hex")
        : randomBytes(3).toString("hex");
    const candidate = `${seed}-${suffix}`.slice(0, 80);
    const existing = await prisma.cvShare.findUnique({
      where: { shareSlug: candidate },
      select: { id: true }
    });
    if (!existing) return candidate;
  }
  return `cv-${createHash("sha1").update(`${Date.now()}-${randomBytes(8).toString("hex")}`).digest("hex").slice(0, 16)}`;
}

export function serializeCvShare(share: {
  id: string;
  documentId: string;
  shareSlug: string;
  isActive: boolean;
  viewCount: number;
  lastViewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: share.id,
    documentId: share.documentId,
    shareSlug: share.shareSlug,
    isActive: share.isActive,
    viewCount: share.viewCount,
    lastViewedAt: share.lastViewedAt?.toISOString() ?? null,
    createdAt: share.createdAt.toISOString(),
    updatedAt: share.updatedAt.toISOString(),
    shareUrl: cvSharePublicUrl(share.shareSlug),
    pdfUrl: cvSharePdfUrl(share.shareSlug)
  };
}

export async function getCvShareForDocument(input: {
  documentId: string;
  profileId: string;
}) {
  return prisma.cvShare.findFirst({
    where: {
      documentId: input.documentId,
      profileId: input.profileId
    }
  });
}

export async function ensureCvShare(input: {
  workspaceId: string;
  profileId: string;
  documentId: string;
  userId: string;
  displayName?: string;
}) {
  const existing = await getCvShareForDocument({
    documentId: input.documentId,
    profileId: input.profileId
  });
  if (existing) return { share: existing, created: false as const };

  const pdf = await prisma.fileAsset.findFirst({
    where: {
      documentId: input.documentId,
      profileId: input.profileId,
      kind: "generated_cv_pdf"
    },
    select: { id: true }
  });
  if (!pdf) {
    return {
      ok: false as const,
      error: "Generate your CV PDF first before creating a share link.",
      status: 400 as const
    };
  }

  const base = slugifyName(input.displayName || "academic-cv") || "academic-cv";
  const shareSlug = await uniqueSlug(base);

  try {
    const share = await prisma.cvShare.create({
      data: {
        workspaceId: input.workspaceId,
        profileId: input.profileId,
        documentId: input.documentId,
        userId: input.userId,
        shareSlug,
        isActive: true
      }
    });

    void prisma.user
      .findUnique({ where: { id: input.userId }, select: { id: true, email: true } })
      .then((user) => {
        if (!user) return;
        return import("@/lib/meta/capi").then(({ sendMetaCapiEvent }) =>
          sendMetaCapiEvent({
            eventName: "CvShareCreated",
            eventId: `cvshare_${share.id}`,
            customData: {
              content_name: "ShareCV",
              content_category: "cv",
              value: 1,
              currency: "USD"
            },
            user: { userId: user.id, email: user.email }
          })
        );
      })
      .catch(() => undefined);

    return { share, created: true as const, ok: true as const };
  } catch {
    // Race: another request created the share for this document.
    const again = await getCvShareForDocument({
      documentId: input.documentId,
      profileId: input.profileId
    });
    if (again) return { share: again, created: false as const, ok: true as const };
    return { ok: false as const, error: "Could not create share link.", status: 500 as const };
  }
}

export async function setCvShareActive(input: {
  documentId: string;
  profileId: string;
  isActive: boolean;
}) {
  const share = await getCvShareForDocument({
    documentId: input.documentId,
    profileId: input.profileId
  });
  if (!share) {
    return { ok: false as const, error: "No share link found for this CV.", status: 404 as const };
  }

  const updated = await prisma.cvShare.update({
    where: { id: share.id },
    data: { isActive: input.isActive }
  });
  return { ok: true as const, share: updated };
}

export async function recordCvShareView(shareId: string) {
  await prisma.cvShare.update({
    where: { id: shareId },
    data: {
      viewCount: { increment: 1 },
      lastViewedAt: new Date()
    }
  });
}

export async function getActiveCvShareBySlug(slug: string) {
  const shareSlug = slug.trim();
  if (!shareSlug) return null;

  const share = await prisma.cvShare.findUnique({
    where: { shareSlug },
    include: {
      profile: {
        select: {
          id: true,
          displayName: true,
          headline: true,
          affiliation: true,
          email: true
        }
      },
      document: {
        select: {
          id: true,
          title: true,
          pdfPath: true,
          pdfFilename: true,
          version: true
        }
      }
    }
  });
  if (!share || !share.isActive) return null;
  return share;
}

export async function getCvSharePdfAsset(input: {
  documentId: string;
  profileId: string;
}) {
  return prisma.fileAsset.findFirst({
    where: {
      documentId: input.documentId,
      profileId: input.profileId,
      kind: "generated_cv_pdf"
    },
    orderBy: { updatedAt: "desc" }
  });
}
