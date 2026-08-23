import { planDisplayName, type PlanKey } from "@/lib/billing/plans";
import { prisma } from "@/lib/prisma";
import { classifyUserAgent, deviceLabel, type DeviceClass } from "@/lib/support/device";

const PAGE_SIZE = 10;

export type AdminUserListItem = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  planKey: string;
  planName: string;
  planExpiresAt: string | null;
  authProviders: string[];
  hasPassword: boolean;
  hasGoogle: boolean;
  cvCount: number;
  pdfCount: number;
  lastDevice: DeviceClass;
  lastDeviceLabel: string;
  isAdmin: boolean;
  workspaceId: string | null;
};

export type AdminUserDetail = AdminUserListItem & {
  firstLoginAt: string | null;
  firstDevice: DeviceClass;
  firstDeviceLabel: string;
  lastUserAgent: string | null;
  firstUserAgent: string | null;
  sessionCount: number;
  aiChatMessageCount: number;
  agentRunCount: number;
  lastPdfAt: string | null;
  lastPdfStatus: string | null;
  lastPdfDocumentId: string | null;
  lastPdfAssetId: string | null;
  lastPdfDownloadUrl: string | null;
  websitePublished: boolean;
  websiteStatus: string | null;
  websiteUsername: string | null;
  websiteUrl: string | null;
  profileDisplayName: string | null;
  paymentCount: number;
  lastPaymentAt: string | null;
};

function adminEmailsSet() {
  return new Set(
    (process.env.CVSCHOLAR_ADMIN_EMAILS || process.env.ADMIN_EMAIL || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

function resolvePlan(sub: { planKey: string; expiresAt: Date | null; status: string } | null | undefined) {
  if (!sub || sub.planKey === "free") {
    return { planKey: "free" as PlanKey, planName: planDisplayName("free"), planExpiresAt: null as string | null };
  }
  const active =
    sub.status === "active" && (!sub.expiresAt || sub.expiresAt.getTime() > Date.now());
  if (!active) {
    return { planKey: "free" as PlanKey, planName: planDisplayName("free"), planExpiresAt: null };
  }
  return {
    planKey: sub.planKey as PlanKey,
    planName: planDisplayName(sub.planKey),
    planExpiresAt: sub.expiresAt?.toISOString() ?? null
  };
}

/** Synthetic guest shells (incl. legacy claim leftovers wrongly marked isGuest=false). */
function isSyntheticGuestClause() {
  return {
    OR: [
      { isGuest: true },
      { id: { startsWith: "guest_" } },
      { email: { endsWith: "@guest.cvscholar.local" } },
      { email: { startsWith: "guest_" } },
      { email: { startsWith: "guest-" } },
      { email: { contains: "@cvscholar.local" } }
    ]
  };
}

export async function listAdminUsers(options: {
  page?: number;
  search?: string;
  pageSize?: number;
  /** When false (default), only real accounts. When true, include guest trial shells. */
  includeGuests?: boolean;
}): Promise<{
  users: AdminUserListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  includeGuests: boolean;
}> {
  const pageSize = Math.min(50, Math.max(1, options.pageSize ?? PAGE_SIZE));
  const page = Math.max(1, options.page ?? 1);
  const search = options.search?.trim() || "";
  const includeGuests = Boolean(options.includeGuests);

  const searchClause = search
    ? {
        OR: [
          { email: { contains: search, mode: "insensitive" as const } },
          { name: { contains: search, mode: "insensitive" as const } }
        ]
      }
    : null;

  // Default: real accounts only. Tick "Include guests" → registered + guest trial shells.
  const where = includeGuests
    ? {
        ...(searchClause ? searchClause : {})
      }
    : {
        AND: [
          { isGuest: false },
          { NOT: isSyntheticGuestClause() },
          ...(searchClause ? [searchClause] : [])
        ]
      };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        accounts: { select: { providerId: true, password: true } },
        sessions: { orderBy: { updatedAt: "desc" }, take: 1, select: { updatedAt: true, userAgent: true } },
        memberships: {
          take: 1,
          orderBy: { createdAt: "asc" },
          include: {
            workspace: {
              include: {
                subscription: true,
                _count: {
                  select: {
                    profiles: true,
                    pdfRenderJobs: true
                  }
                },
                profiles: {
                  take: 1,
                  include: { _count: { select: { cvDocuments: true } } }
                }
              }
            }
          }
        }
      }
    })
  ]);

  const admins = adminEmailsSet();

  const mapped: AdminUserListItem[] = users.map((user) => {
    const membership = user.memberships[0];
    const workspace = membership?.workspace;
    const plan = resolvePlan(workspace?.subscription ?? null);
    const providers = user.accounts.map((a) => a.providerId);
    const hasGoogle = providers.some((p) => p === "google");
    const hasPassword = user.accounts.some((a) => a.providerId === "credential" || Boolean(a.password));
    const lastSession = user.sessions[0];
    const lastDevice = classifyUserAgent(lastSession?.userAgent);
    const cvCount = workspace?.profiles?.[0]?._count?.cvDocuments ?? 0;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: lastSession?.updatedAt?.toISOString() ?? null,
      planKey: plan.planKey,
      planName: plan.planName,
      planExpiresAt: plan.planExpiresAt,
      authProviders: providers,
      hasPassword,
      hasGoogle,
      cvCount,
      pdfCount: workspace?._count?.pdfRenderJobs ?? 0,
      lastDevice,
      lastDeviceLabel: deviceLabel(lastDevice),
      isAdmin: admins.has(user.email.toLowerCase()),
      workspaceId: workspace?.id ?? null
    };
  });

  return {
    users: mapped,
    includeGuests,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  };
}

export async function getAdminUserDetail(userId: string): Promise<AdminUserDetail | null> {
  const user = await prisma.user.findFirst({
    where: { id: userId },
    include: {
      accounts: { select: { providerId: true, password: true } },
      sessions: {
        orderBy: { createdAt: "asc" },
        select: { createdAt: true, updatedAt: true, userAgent: true, ipAddress: true }
      },
      memberships: {
        take: 1,
        orderBy: { createdAt: "asc" },
        include: {
          workspace: {
            include: {
              subscription: true,
              billingPayments: { orderBy: { createdAt: "desc" }, take: 1 },
              _count: {
                select: {
                  pdfRenderJobs: true,
                  agentRuns: true,
                  billingPayments: true
                }
              },
              profiles: {
                take: 1,
                include: {
                  academicWebsite: {
                    select: { status: true, username: true, publishedAt: true }
                  },
                  _count: { select: { cvDocuments: true } },
                  agentSessions: {
                    select: {
                      id: true,
                      _count: { select: { messages: true } }
                    }
                  }
                }
              },
              pdfRenderJobs: {
                orderBy: { createdAt: "desc" },
                take: 1,
                select: {
                  id: true,
                  status: true,
                  createdAt: true,
                  finishedAt: true,
                  documentId: true,
                  fileAssetId: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!user) return null;

  const membership = user.memberships[0];
  const workspace = membership?.workspace;
  const plan = resolvePlan(workspace?.subscription ?? null);
  const providers = user.accounts.map((a) => a.providerId);
  const hasGoogle = providers.some((p) => p === "google");
  const hasPassword = user.accounts.some((a) => a.providerId === "credential" || Boolean(a.password));

  const sessionsAsc = user.sessions;
  const firstSession = sessionsAsc[0] ?? null;
  const lastSession = sessionsAsc.length ? sessionsAsc[sessionsAsc.length - 1] : null;
  // Prefer most recently updated for last login
  const lastByUpdate = [...sessionsAsc].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
  )[0];

  const firstDevice = classifyUserAgent(firstSession?.userAgent);
  const lastDevice = classifyUserAgent(lastByUpdate?.userAgent ?? lastSession?.userAgent);

  const profile = workspace?.profiles?.[0];
  const website = profile?.academicWebsite;
  const lastPdf = workspace?.pdfRenderJobs?.[0] ?? null;
  const aiChatMessageCount =
    profile?.agentSessions?.reduce((sum, s) => sum + (s._count?.messages ?? 0), 0) ?? 0;

  let websiteUrl: string | null = null;
  if (website?.username && (website.status === "published" || website.publishedAt)) {
    const root =
      process.env.NEXT_PUBLIC_WEBSITE_ROOT_DOMAIN ||
      process.env.CVSCHOLAR_WEBSITE_ROOT_DOMAIN ||
      "cvscholar.com";
    websiteUrl = `https://${website.username}.${root}`;
  }

  const admins = adminEmailsSet();

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: lastByUpdate?.updatedAt?.toISOString() ?? null,
    firstLoginAt: firstSession?.createdAt?.toISOString() ?? user.createdAt.toISOString(),
    planKey: plan.planKey,
    planName: plan.planName,
    planExpiresAt: plan.planExpiresAt,
    authProviders: providers,
    hasPassword,
    hasGoogle,
    cvCount: profile?._count?.cvDocuments ?? 0,
    pdfCount: workspace?._count?.pdfRenderJobs ?? 0,
    lastDevice,
    lastDeviceLabel: deviceLabel(lastDevice),
    firstDevice,
    firstDeviceLabel: deviceLabel(firstDevice),
    lastUserAgent: lastByUpdate?.userAgent ?? null,
    firstUserAgent: firstSession?.userAgent ?? null,
    isAdmin: admins.has(user.email.toLowerCase()),
    workspaceId: workspace?.id ?? null,
    sessionCount: sessionsAsc.length,
    aiChatMessageCount,
    agentRunCount: workspace?._count?.agentRuns ?? 0,
    lastPdfAt: (lastPdf?.finishedAt ?? lastPdf?.createdAt)?.toISOString() ?? null,
    lastPdfStatus: lastPdf?.status ?? null,
    lastPdfDocumentId: lastPdf?.documentId ?? null,
    lastPdfAssetId: lastPdf?.fileAssetId ?? null,
    lastPdfDownloadUrl: lastPdf?.fileAssetId
      ? `/api/admin/users/${user.id}/pdfs/${lastPdf.fileAssetId}`
      : null,
    websitePublished: Boolean(website && (website.status === "published" || website.publishedAt)),
    websiteStatus: website?.status ?? null,
    websiteUsername: website?.username ?? null,
    websiteUrl,
    profileDisplayName: profile?.displayName || null,
    paymentCount: workspace?._count?.billingPayments ?? 0,
    lastPaymentAt: workspace?.billingPayments?.[0]?.createdAt?.toISOString() ?? null
  };
}

