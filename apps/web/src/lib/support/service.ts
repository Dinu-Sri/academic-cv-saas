import type { User } from "@/generated/prisma/client";
import { planDisplayName, type PlanKey } from "@/lib/billing/plans";
import { storeWorkspaceFile } from "@/lib/file-storage";
import { prisma } from "@/lib/prisma";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";
import { sendTicketCreatedEmails, sendTicketReplyEmails } from "@/lib/support/email";
import {
  isSupportTicketPriority,
  isSupportTicketStatus,
  isSupportTicketType,
  SUPPORT_IMAGE_MIME,
  SUPPORT_MAX_IMAGE_BYTES,
  SUPPORT_MAX_IMAGES_PER_MESSAGE,
  type SupportAttachmentDto,
  type SupportMessageDto,
  type SupportTicketDetail,
  type SupportTicketListItem,
  type SupportUserContext
} from "@/lib/support/types";

function daysBetween(from: Date, to: Date) {
  return Math.max(0, Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)));
}

async function generateTicketNumber(): Promise<string> {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `TKT-${day}-`;
  const count = await prisma.supportTicket.count({
    where: { ticketNumber: { startsWith: prefix } }
  });
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}

function attachmentDto(id: string, filename: string, mimeType: string, byteSize: number): SupportAttachmentDto {
  return {
    id,
    filename,
    mimeType,
    byteSize,
    url: `/api/support/attachments/${id}`
  };
}

function mapMessage(message: {
  id: string;
  body: string;
  isAdminReply: boolean;
  createdAt: Date;
  author: { name: string; email: string };
  attachments: Array<{
    id: string;
    filename: string;
    mimeType: string;
    byteSize: number;
  }>;
}): SupportMessageDto {
  return {
    id: message.id,
    body: message.body,
    isAdminReply: message.isAdminReply,
    authorName: message.author.name,
    authorEmail: message.author.email,
    createdAt: message.createdAt.toISOString(),
    attachments: message.attachments.map((a) => attachmentDto(a.id, a.filename, a.mimeType, a.byteSize))
  };
}

function mapListItem(ticket: {
  id: string;
  ticketNumber: string;
  type: string;
  subject: string;
  status: string;
  priority: string;
  hasUnreadAdminReply: boolean;
  hasUnreadUserReply: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: { messages: number };
  messages?: Array<{ createdAt: Date }>;
  user?: { id: string; name: string; email: string };
}): SupportTicketListItem {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    type: ticket.type,
    subject: ticket.subject,
    status: ticket.status,
    priority: ticket.priority,
    hasUnreadAdminReply: ticket.hasUnreadAdminReply,
    hasUnreadUserReply: ticket.hasUnreadUserReply,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    messageCount: ticket._count?.messages ?? ticket.messages?.length ?? 0,
    lastMessageAt: ticket.messages?.[0]?.createdAt?.toISOString() ?? ticket.updatedAt.toISOString(),
    ...(ticket.user
      ? {
          user: {
            id: ticket.user.id,
            name: ticket.user.name,
            email: ticket.user.email
          }
        }
      : {})
  };
}

export async function countUnreadForUser(userId: string) {
  return prisma.supportTicket.count({
    where: { userId, hasUnreadAdminReply: true }
  });
}

export async function countUnreadForAdmin() {
  return prisma.supportTicket.count({
    where: {
      hasUnreadUserReply: true,
      status: { in: ["open", "in_progress"] }
    }
  });
}

export async function listTicketsForUser(userId: string): Promise<SupportTicketListItem[]> {
  const tickets = await prisma.supportTicket.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { messages: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } }
    }
  });
  return tickets.map(mapListItem);
}

export async function listTicketsForAdmin(filters?: {
  status?: string;
  type?: string;
  search?: string;
}): Promise<SupportTicketListItem[]> {
  const status = filters?.status && isSupportTicketStatus(filters.status) ? filters.status : undefined;
  const type = filters?.type && isSupportTicketType(filters.type) ? filters.type : undefined;
  const search = filters?.search?.trim() || "";

  const tickets = await prisma.supportTicket.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(search
        ? {
            OR: [
              { ticketNumber: { contains: search, mode: "insensitive" } },
              { subject: { contains: search, mode: "insensitive" } },
              { user: { email: { contains: search, mode: "insensitive" } } },
              { user: { name: { contains: search, mode: "insensitive" } } }
            ]
          }
        : {})
    },
    orderBy: [{ hasUnreadUserReply: "desc" }, { updatedAt: "desc" }],
    include: {
      user: { select: { id: true, name: true, email: true } },
      _count: { select: { messages: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } }
    }
  });
  return tickets.map(mapListItem);
}

export async function buildUserContext(userId: string): Promise<SupportUserContext> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        take: 1,
        include: {
          workspace: {
            include: {
              subscription: true,
              billingPayments: { orderBy: { createdAt: "desc" }, take: 1 },
              _count: { select: { billingPayments: true } },
              profiles: {
                take: 1,
                include: {
                  cvDocuments: { select: { id: true } },
                  academicWebsite: {
                    select: { status: true, username: true }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  if (!user) {
    return {
      id: userId,
      name: "Unknown",
      email: "",
      emailVerified: false,
      accountCreatedAt: new Date(0).toISOString(),
      isGuest: false,
      workspaceId: null,
      workspaceName: null,
      workspaceSlug: null,
      planKey: "free",
      planName: "Free",
      planStatus: "unknown",
      isPaid: false,
      planExpiresAt: null,
      daysRemaining: null,
      paymentCount: 0,
      lastPaymentAt: null,
      profileDisplayName: null,
      cvDocumentCount: 0,
      websiteStatus: null,
      websiteUsername: null
    };
  }

  const membership = user.memberships[0];
  const workspace = membership?.workspace;
  const sub = workspace?.subscription;
  const planKey = (sub?.planKey || "free") as PlanKey;
  const isPaid = planKey !== "free" && sub?.status === "active";
  const expiresAt = sub?.expiresAt ?? null;
  const profile = workspace?.profiles?.[0];
  const website = profile?.academicWebsite;
  const payments = workspace?.billingPayments ?? [];

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    accountCreatedAt: user.createdAt.toISOString(),
    isGuest: user.isGuest,
    workspaceId: workspace?.id ?? null,
    workspaceName: workspace?.name ?? null,
    workspaceSlug: workspace?.slug ?? null,
    planKey,
    planName: planDisplayName(planKey),
    planStatus: sub?.status || "none",
    isPaid,
    planExpiresAt: expiresAt?.toISOString() ?? null,
    daysRemaining: expiresAt && isPaid ? daysBetween(new Date(), expiresAt) : null,
    paymentCount: workspace?._count?.billingPayments ?? payments.length,
    lastPaymentAt: payments[0]?.createdAt?.toISOString() ?? null,
    profileDisplayName: profile?.displayName ?? null,
    cvDocumentCount: profile?.cvDocuments?.length ?? 0,
    websiteStatus: website?.status ?? null,
    websiteUsername: website?.username ?? null
  };
}

export async function getTicketDetailForUser(
  ticketId: string,
  userId: string,
  options?: { markAdminRead?: boolean }
): Promise<SupportTicketDetail | null> {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, userId },
    include: {
      _count: { select: { messages: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { name: true, email: true } },
          attachments: true
        }
      }
    }
  });
  if (!ticket) return null;

  if (options?.markAdminRead && ticket.hasUnreadAdminReply) {
    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { hasUnreadAdminReply: false }
    });
    ticket.hasUnreadAdminReply = false;
  }

  return {
    ...mapListItem(ticket),
    messages: ticket.messages.map(mapMessage)
  };
}

export async function getTicketDetailForAdmin(
  ticketId: string,
  options?: { markUserRead?: boolean }
): Promise<SupportTicketDetail | null> {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      _count: { select: { messages: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { name: true, email: true } },
          attachments: true
        }
      }
    }
  });
  if (!ticket) return null;

  if (options?.markUserRead && ticket.hasUnreadUserReply) {
    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { hasUnreadUserReply: false }
    });
    ticket.hasUnreadUserReply = false;
  }

  const userContext = await buildUserContext(ticket.userId);

  return {
    ...mapListItem(ticket),
    messages: ticket.messages.map(mapMessage),
    userContext
  };
}

export async function parseImageFiles(formData: FormData, fieldName = "attachments"): Promise<
  | { ok: true; files: File[] }
  | { ok: false; error: string }
> {
  const raw = formData.getAll(fieldName).filter((v): v is File => v instanceof File && v.size > 0);
  // Also accept single "attachment" field
  const single = formData.get("attachment");
  if (single instanceof File && single.size > 0) {
    raw.push(single);
  }

  if (raw.length > SUPPORT_MAX_IMAGES_PER_MESSAGE) {
    return { ok: false, error: `You can attach up to ${SUPPORT_MAX_IMAGES_PER_MESSAGE} images per message.` };
  }

  for (const file of raw) {
    if (!SUPPORT_IMAGE_MIME.has(file.type)) {
      return { ok: false, error: "Images only: JPG, PNG, GIF, or WebP." };
    }
    if (file.size > SUPPORT_MAX_IMAGE_BYTES) {
      return { ok: false, error: "Each image must be 5MB or smaller." };
    }
  }

  return { ok: true, files: raw };
}

async function storeAttachments(files: File[], workspaceId: string, messageId: string) {
  for (const file of files) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const stored = await storeWorkspaceFile({
      bytes,
      workspaceId,
      filename: file.name || "attachment.jpg",
      mimeType: file.type,
      prefix: "support-tickets"
    });
    await prisma.supportTicketAttachment.create({
      data: {
        messageId,
        storageProvider: stored.storageProvider,
        bucket: stored.bucket,
        objectKey: stored.objectKey,
        localPath: stored.localPath,
        filename: stored.filename,
        mimeType: stored.mimeType,
        byteSize: stored.byteSize,
        checksumSha256: stored.checksumSha256
      }
    });
  }
}

export async function createTicket(input: {
  user: Pick<User, "id" | "name" | "email">;
  type: string;
  subject: string;
  message: string;
  files: File[];
}) {
  if (!isSupportTicketType(input.type)) {
    throw new Error("Please choose a valid ticket type.");
  }
  const subject = input.subject.trim();
  const message = input.message.trim();
  if (subject.length < 5) throw new Error("Subject must be at least 5 characters.");
  if (message.length < 10) throw new Error("Message must be at least 10 characters.");

  const { workspace } = await getOrCreateWorkspaceForUser(input.user);
  const ticketNumber = await generateTicketNumber();

  const ticket = await prisma.supportTicket.create({
    data: {
      ticketNumber,
      userId: input.user.id,
      workspaceId: workspace.id,
      type: input.type,
      subject,
      status: "open",
      priority: "medium",
      hasUnreadAdminReply: false,
      hasUnreadUserReply: true,
      messages: {
        create: {
          authorUserId: input.user.id,
          isAdminReply: false,
          body: message
        }
      }
    },
    include: {
      messages: { orderBy: { createdAt: "asc" }, take: 1 }
    }
  });

  const firstMessage = ticket.messages[0];
  if (firstMessage && input.files.length > 0) {
    await storeAttachments(input.files, workspace.id, firstMessage.id);
  }

  void sendTicketCreatedEmails({
    ticketNumber: ticket.ticketNumber,
    ticketId: ticket.id,
    subject: ticket.subject,
    type: ticket.type,
    message,
    userName: input.user.name,
    userEmail: input.user.email
  }).catch((err) => console.error("[support] create email", err));

  return getTicketDetailForUser(ticket.id, input.user.id);
}

export async function replyToTicketAsUser(input: {
  ticketId: string;
  user: Pick<User, "id" | "name" | "email">;
  message: string;
  files: File[];
}) {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: input.ticketId, userId: input.user.id }
  });
  if (!ticket) throw new Error("Ticket not found.");
  if (ticket.status === "closed") throw new Error("This ticket is closed.");

  const body = input.message.trim();
  if (body.length < 5 && input.files.length === 0) {
    throw new Error("Reply must be at least 5 characters (or include an image).");
  }

  const workspaceId =
    ticket.workspaceId ||
    (await getOrCreateWorkspaceForUser(input.user)).workspace.id;

  const message = await prisma.supportTicketMessage.create({
    data: {
      ticketId: ticket.id,
      authorUserId: input.user.id,
      isAdminReply: false,
      body: body || "(image attachment)"
    }
  });

  if (input.files.length > 0) {
    await storeAttachments(input.files, workspaceId, message.id);
  }

  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: {
      hasUnreadUserReply: true,
      hasUnreadAdminReply: false,
      status: ticket.status === "resolved" ? "open" : ticket.status,
      updatedAt: new Date()
    }
  });

  void sendTicketReplyEmails({
    ticketNumber: ticket.ticketNumber,
    ticketId: ticket.id,
    subject: ticket.subject,
    message: body || "(image attachment)",
    isAdminReply: false,
    userName: input.user.name,
    userEmail: input.user.email
  }).catch((err) => console.error("[support] user reply email", err));

  return getTicketDetailForUser(ticket.id, input.user.id);
}

export async function replyToTicketAsAdmin(input: {
  ticketId: string;
  admin: Pick<User, "id" | "name" | "email">;
  message: string;
  files: File[];
  status?: string;
}) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: input.ticketId },
    include: { user: true }
  });
  if (!ticket) throw new Error("Ticket not found.");
  if (ticket.status === "closed" && !input.status) {
    throw new Error("This ticket is closed. Re-open it before replying.");
  }

  const body = input.message.trim();
  if (body.length < 5 && input.files.length === 0) {
    throw new Error("Reply must be at least 5 characters (or include an image).");
  }

  const workspaceId =
    ticket.workspaceId ||
    (await getOrCreateWorkspaceForUser(ticket.user)).workspace.id;

  const message = await prisma.supportTicketMessage.create({
    data: {
      ticketId: ticket.id,
      authorUserId: input.admin.id,
      isAdminReply: true,
      body: body || "(image attachment)"
    }
  });

  if (input.files.length > 0) {
    await storeAttachments(input.files, workspaceId, message.id);
  }

  const nextStatus =
    input.status && isSupportTicketStatus(input.status)
      ? input.status
      : ticket.status === "open"
        ? "in_progress"
        : ticket.status;

  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: {
      hasUnreadAdminReply: true,
      hasUnreadUserReply: false,
      status: nextStatus,
      updatedAt: new Date()
    }
  });

  void sendTicketReplyEmails({
    ticketNumber: ticket.ticketNumber,
    ticketId: ticket.id,
    subject: ticket.subject,
    message: body || "(image attachment)",
    isAdminReply: true,
    userName: ticket.user.name,
    userEmail: ticket.user.email,
    adminName: input.admin.name || "Support"
  }).catch((err) => console.error("[support] admin reply email", err));

  return getTicketDetailForAdmin(ticket.id);
}

export async function updateTicketMetaAsAdmin(input: {
  ticketId: string;
  status?: string;
  priority?: string;
}) {
  const data: { status?: string; priority?: string; updatedAt: Date } = { updatedAt: new Date() };
  if (input.status) {
    if (!isSupportTicketStatus(input.status)) throw new Error("Invalid status.");
    data.status = input.status;
  }
  if (input.priority) {
    if (!isSupportTicketPriority(input.priority)) throw new Error("Invalid priority.");
    data.priority = input.priority;
  }

  await prisma.supportTicket.update({
    where: { id: input.ticketId },
    data
  });

  return getTicketDetailForAdmin(input.ticketId);
}

export async function getAttachmentForAccess(attachmentId: string, actor: { userId: string; isAdmin: boolean }) {
  const attachment = await prisma.supportTicketAttachment.findUnique({
    where: { id: attachmentId },
    include: {
      message: {
        include: {
          ticket: true
        }
      }
    }
  });
  if (!attachment) return null;

  const ticket = attachment.message.ticket;
  if (!actor.isAdmin && ticket.userId !== actor.userId) {
    return null;
  }

  return attachment;
}
