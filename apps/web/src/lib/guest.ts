import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import type { User } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

export const GUEST_COOKIE = "cvscholar_guest";
export const GUEST_MAX_COMPILE = 3;
export const GUEST_MAX_CHAT = 10;
export const GUEST_LIMIT_CODE = "GUEST_LIMIT_REACHED";
export const GUEST_TTL_DAYS = 14;

export type ActorUser = Pick<User, "id" | "name" | "email" | "emailVerified" | "image" | "createdAt"> & {
  isGuest?: boolean;
};

export type GuestUsage = {
  compileCount: number;
  chatCount: number;
  compileRemaining: number;
  chatRemaining: number;
  maxCompile: number;
  maxChat: number;
};

function guestEmail(token: string) {
  const hash = createHash("sha256").update(token).digest("hex").slice(0, 16);
  return `guest-${hash}@guest.cvscholar.local`;
}

function newGuestToken() {
  return randomBytes(24).toString("hex");
}

function expiresAt() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + GUEST_TTL_DAYS);
  return d;
}

export async function readGuestTokenFromCookies(): Promise<string | null> {
  const store = await cookies();
  return store.get(GUEST_COOKIE)?.value?.trim() || null;
}

export async function setGuestTokenCookie(token: string) {
  try {
    const store = await cookies();
    store.set(GUEST_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: GUEST_TTL_DAYS * 24 * 60 * 60
    });
  } catch {
    // Server Components cannot always set cookies; middleware/API may own the cookie.
  }
}

export async function clearGuestTokenCookie() {
  const store = await cookies();
  store.delete(GUEST_COOKIE);
}

/** Create or resume guest user + workspace bound to cookie token. */
export async function getOrCreateGuestActor(): Promise<{
  user: ActorUser;
  guestToken: string;
  usage: GuestUsage;
  isNew: boolean;
}> {
  let token = await readGuestTokenFromCookies();
  let isNew = false;

  if (token) {
    const existing = await prisma.guestSession.findUnique({
      where: { token },
      include: { user: true }
    });
    if (existing && !existing.convertedAt && existing.expiresAt.getTime() > Date.now() && existing.user.isGuest) {
      return {
        user: toActor(existing.user),
        guestToken: token,
        usage: usageFrom(existing),
        isNew: false
      };
    }
  }

  token = newGuestToken();
  isNew = true;
  const userId = `guest_${randomBytes(12).toString("hex")}`;

  const user = await prisma.user.create({
    data: {
      id: userId,
      name: "Guest",
      email: guestEmail(token),
      emailVerified: false,
      isGuest: true,
      guestSession: {
        create: {
          token,
          compileCount: 0,
          chatCount: 0,
          expiresAt: expiresAt()
        }
      }
    },
    include: { guestSession: true }
  });

  await getOrCreateWorkspaceForUser(user);
  await setGuestTokenCookie(token);

  return {
    user: toActor(user),
    guestToken: token,
    usage: usageFrom(user.guestSession!),
    isNew
  };
}

function toActor(user: User): ActorUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    image: user.image,
    createdAt: user.createdAt,
    isGuest: user.isGuest
  };
}

function usageFrom(session: { compileCount: number; chatCount: number }): GuestUsage {
  return {
    compileCount: session.compileCount,
    chatCount: session.chatCount,
    compileRemaining: Math.max(0, GUEST_MAX_COMPILE - session.compileCount),
    chatRemaining: Math.max(0, GUEST_MAX_CHAT - session.chatCount),
    maxCompile: GUEST_MAX_COMPILE,
    maxChat: GUEST_MAX_CHAT
  };
}

export async function getGuestUsageForUser(userId: string): Promise<GuestUsage | null> {
  const session = await prisma.guestSession.findUnique({ where: { userId } });
  if (!session || session.convertedAt) return null;
  return usageFrom(session);
}

export async function assertGuestCompileAllowed(userId: string) {
  const session = await prisma.guestSession.findUnique({ where: { userId } });
  if (!session || session.convertedAt) return { ok: true as const };
  if (session.compileCount >= GUEST_MAX_COMPILE) {
    return {
      ok: false as const,
      code: GUEST_LIMIT_CODE,
      limit: "compile" as const,
      used: session.compileCount,
      max: GUEST_MAX_COMPILE,
      error: `Free trial includes ${GUEST_MAX_COMPILE} PDF compiles. Create a free account to continue.`
    };
  }
  return { ok: true as const, sessionId: session.id };
}

export async function assertGuestChatAllowed(userId: string) {
  const session = await prisma.guestSession.findUnique({ where: { userId } });
  if (!session || session.convertedAt) return { ok: true as const };
  if (session.chatCount >= GUEST_MAX_CHAT) {
    return {
      ok: false as const,
      code: GUEST_LIMIT_CODE,
      limit: "chat" as const,
      used: session.chatCount,
      max: GUEST_MAX_CHAT,
      error: `Free trial includes ${GUEST_MAX_CHAT} AI chat messages. Create a free account to continue.`
    };
  }
  return { ok: true as const, sessionId: session.id };
}

export async function incrementGuestCompile(userId: string) {
  const session = await prisma.guestSession.findUnique({ where: { userId } });
  if (!session || session.convertedAt) return;
  await prisma.guestSession.update({
    where: { id: session.id },
    data: { compileCount: { increment: 1 } }
  });
}

export async function incrementGuestChat(userId: string) {
  const session = await prisma.guestSession.findUnique({ where: { userId } });
  if (!session || session.convertedAt) return;
  await prisma.guestSession.update({
    where: { id: session.id },
    data: { chatCount: { increment: 1 } }
  });
}

/**
 * Move guest workspace + profile onto a real authenticated user.
 * Prefer when the real user has little/no content yet (typical signup).
 */
export async function claimGuestDataForUser(realUser: Pick<User, "id" | "name" | "email">, guestToken?: string | null) {
  const token = guestToken ?? (await readGuestTokenFromCookies());
  if (!token) return { claimed: false as const, reason: "no_guest_cookie" as const };

  const guest = await prisma.guestSession.findUnique({
    where: { token },
    include: { user: true }
  });
  if (!guest || guest.convertedAt || !guest.user.isGuest) {
    await clearGuestTokenCookie();
    return { claimed: false as const, reason: "invalid_guest" as const };
  }

  if (guest.userId === realUser.id) {
    await clearGuestTokenCookie();
    return { claimed: false as const, reason: "same_user" as const };
  }

  const guestMember = await prisma.workspaceMember.findFirst({
    where: { userId: guest.userId, role: "owner" },
    include: {
      workspace: {
        include: {
          profiles: { where: { ownerUserId: guest.userId }, take: 1 }
        }
      }
    }
  });

  if (!guestMember) {
    await prisma.guestSession.update({
      where: { id: guest.id },
      data: { convertedAt: new Date() }
    });
    await clearGuestTokenCookie();
    return { claimed: false as const, reason: "no_workspace" as const };
  }

  // Real user existing membership
  const realMember = await prisma.workspaceMember.findFirst({
    where: { userId: realUser.id },
    include: {
      workspace: {
        include: {
          profiles: { where: { ownerUserId: realUser.id }, take: 1 }
        }
      }
    }
  });

  const realProfileId = realMember?.workspace.profiles[0]?.id;
  let realHasContent = false;
  if (realProfileId) {
    const entryCount = await prisma.profileSectionEntry.count({
      where: { profileId: realProfileId, archivedAt: null }
    });
    realHasContent = entryCount > 0;
  }

  if (realHasContent) {
    // Keep real account data; just mark guest converted.
    await prisma.guestSession.update({
      where: { id: guest.id },
      data: { convertedAt: new Date() }
    });
    await clearGuestTokenCookie();
    return { claimed: false as const, reason: "real_user_has_data" as const };
  }

  const guestWorkspaceId = guestMember.workspaceId;
  const guestProfile = guestMember.workspace.profiles[0];

  await prisma.$transaction(async (tx) => {
    // Point membership at real user
    await tx.workspaceMember.deleteMany({ where: { userId: realUser.id } });
    await tx.workspaceMember.updateMany({
      where: { workspaceId: guestWorkspaceId, userId: guest.userId },
      data: { userId: realUser.id }
    });

    if (guestProfile) {
      await tx.academicProfile.update({
        where: { id: guestProfile.id },
        data: {
          ownerUserId: realUser.id,
          email: realUser.email || guestProfile.email,
          displayName:
            guestProfile.displayName && guestProfile.displayName !== "Guest"
              ? guestProfile.displayName
              : realUser.name || guestProfile.displayName
        }
      });
    }

    // Drop empty bootstrap workspace for real user if different
    if (realMember && realMember.workspaceId !== guestWorkspaceId) {
      await tx.workspace.delete({ where: { id: realMember.workspaceId } }).catch(() => undefined);
    }

    await tx.guestSession.update({
      where: { id: guest.id },
      data: { convertedAt: new Date() }
    });

    await tx.user.update({
      where: { id: guest.userId },
      data: { isGuest: false, name: `Converted guest ${guest.userId.slice(0, 8)}` }
    });
  });

  await clearGuestTokenCookie();
  return { claimed: true as const, workspaceId: guestWorkspaceId };
}
