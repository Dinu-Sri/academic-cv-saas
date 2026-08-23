import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { websiteFeatureEnabled } from "./constants";

const HOURLY_LIMIT = Math.max(1, Number.parseInt(process.env.CVSCHOLAR_WEBSITE_CONTACT_RATE_LIMIT_HOURLY || "5", 10));
const DAILY_LIMIT = Math.max(1, Number.parseInt(process.env.CVSCHOLAR_WEBSITE_CONTACT_RATE_LIMIT_DAILY || "20", 10));

export function websiteContactEnabled() {
  return websiteFeatureEnabled() && process.env.CVSCHOLAR_WEBSITE_CONTACT_ENABLED !== "0";
}

export async function verifyTurnstileToken(token: string, ip?: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY || "";
  if (!secret) {
    // If Turnstile is not configured, allow submissions in non-production for staging.
    return process.env.NODE_ENV !== "production";
  }
  if (!token.trim()) return false;

  const body = new URLSearchParams({
    secret,
    response: token,
    ...(ip ? { remoteip: ip } : {})
  });

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const result = (await response.json()) as { success?: boolean };
  return Boolean(result.success);
}

export async function submitWebsiteContact({
  username,
  visitorName,
  visitorEmail,
  subject,
  message,
  turnstileToken,
  ip,
  userAgent
}: {
  username: string;
  visitorName: string;
  visitorEmail: string;
  subject?: string;
  message: string;
  turnstileToken?: string;
  ip?: string;
  userAgent?: string;
}) {
  if (!websiteContactEnabled()) {
    throw Object.assign(new Error("Contact form is disabled."), { status: 503 });
  }

  const website = await prisma.academicWebsite.findFirst({
    where: {
      username: username.toLowerCase(),
      status: "published",
      archivedAt: null,
      blockedAt: null,
      contactFormEnabled: true
    },
    include: {
      profile: {
        select: { email: true, displayName: true }
      }
    }
  });

  if (!website) {
    throw Object.assign(new Error("Website is not available for contact."), { status: 404 });
  }

  const name = visitorName.trim().slice(0, 120);
  const email = visitorEmail.trim().slice(0, 200);
  const body = message.trim().slice(0, 4000);
  const topic = (subject || "").trim().slice(0, 200);

  if (name.length < 2 || !email.includes("@") || body.length < 10) {
    throw Object.assign(new Error("Please complete the contact form."), { status: 422 });
  }

  const turnstileValid = await verifyTurnstileToken(turnstileToken || "", ip);
  if (!turnstileValid) {
    throw Object.assign(new Error("Spam check failed. Please try again."), { status: 403 });
  }

  const ipHash = hashValue(ip || "unknown");
  const userAgentHash = hashValue(userAgent || "");
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [hourly, daily] = await Promise.all([
    prisma.websiteContactMessage.count({
      where: { websiteId: website.id, ipHash, createdAt: { gte: hourAgo } }
    }),
    prisma.websiteContactMessage.count({
      where: { websiteId: website.id, ipHash, createdAt: { gte: dayAgo } }
    })
  ]);

  if (hourly >= HOURLY_LIMIT || daily >= DAILY_LIMIT) {
    throw Object.assign(new Error("Too many messages. Please try again later."), { status: 429 });
  }

  const spamScore = scoreSpam({ name, email, body });
  const created = await prisma.websiteContactMessage.create({
    data: {
      websiteId: website.id,
      workspaceId: website.workspaceId,
      profileId: website.profileId,
      visitorName: name,
      visitorEmail: email,
      subject: topic,
      message: body,
      status: spamScore >= 0.8 ? "spam" : "unread",
      ipHash,
      userAgentHash,
      spamScore,
      turnstileValid
    }
  });

  if (created.status === "unread") {
    await sendOptionalContactEmail({
      ownerEmail: website.profile.email,
      ownerName: website.profile.displayName,
      visitorName: name,
      visitorEmail: email,
      subject: topic,
      message: body,
      username: website.username
    }).catch(() => undefined);
  }

  return { id: created.id, status: created.status };
}

export async function listWebsiteMessagesForOwner(workspaceId: string, profileId: string) {
  const website = await prisma.academicWebsite.findFirst({
    where: { workspaceId, profileId }
  });
  if (!website) return [];

  const messages = await prisma.websiteContactMessage.findMany({
    where: {
      websiteId: website.id,
      archivedAt: null,
      status: { not: "spam" }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return messages.map((message) => ({
    id: message.id,
    visitorName: message.visitorName,
    visitorEmail: message.visitorEmail,
    subject: message.subject,
    message: message.message,
    status: message.status,
    createdAt: message.createdAt.toISOString(),
    readAt: message.readAt?.toISOString() ?? null
  }));
}

export async function markWebsiteMessageRead(workspaceId: string, profileId: string, messageId: string) {
  const website = await prisma.academicWebsite.findFirst({ where: { workspaceId, profileId } });
  if (!website) throw Object.assign(new Error("Website not found."), { status: 404 });

  const message = await prisma.websiteContactMessage.findFirst({
    where: { id: messageId, websiteId: website.id }
  });
  if (!message) throw Object.assign(new Error("Message not found."), { status: 404 });

  return prisma.websiteContactMessage.update({
    where: { id: message.id },
    data: {
      status: message.status === "unread" ? "read" : message.status,
      readAt: message.readAt ?? new Date()
    }
  });
}

function hashValue(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 48);
}

function scoreSpam({ name, email, body }: { name: string; email: string; body: string }) {
  let score = 0;
  const text = `${name} ${email} ${body}`.toLowerCase();
  if (/(viagra|crypto airdrop|casino|loan approval|click here)/.test(text)) score += 0.7;
  if ((body.match(/https?:\/\//g) || []).length > 3) score += 0.3;
  if (body.length > 2500) score += 0.1;
  return Math.min(1, score);
}

async function sendOptionalContactEmail(input: {
  ownerEmail: string;
  ownerName: string;
  visitorName: string;
  visitorEmail: string;
  subject: string;
  message: string;
  username: string;
}) {
  if (!input.ownerEmail.trim()) return;

  const { sendTransactionalEmail } = await import("@/lib/email");
  const { buildWebsiteContactEmail } = await import("@/lib/email/templates/catalog");
  const built = buildWebsiteContactEmail({
    ownerName: input.ownerName,
    username: input.username,
    visitorName: input.visitorName,
    visitorEmail: input.visitorEmail,
    subject: input.subject,
    message: input.message
  });
  await sendTransactionalEmail({
    to: input.ownerEmail,
    subject: built.subject,
    text: built.text,
    html: built.html,
    replyTo: input.visitorEmail,
    tags: built.tags
  });
}
