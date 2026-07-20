import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  getGuestUsageForUser,
  getOrCreateGuestActor,
  peekGuestActor,
  type ActorUser,
  type GuestUsage
} from "@/lib/guest";
import { prisma } from "@/lib/prisma";

export type RequestActor = {
  user: ActorUser;
  isGuest: boolean;
  usage: GuestUsage | null;
};

/**
 * Resolve logged-in user, or guest trial actor.
 * Use for product surfaces that guests may access.
 */
export async function resolveRequestActor(options?: {
  /** When false, guests are not used (returns null). Default true. */
  allowGuest?: boolean;
  /**
   * When true (default), create guest user+workspace if missing.
   * Set false for lightweight status checks / marketing pages.
   */
  createGuest?: boolean;
}): Promise<RequestActor | null> {
  const allowGuest = options?.allowGuest !== false;
  const createGuest = options?.createGuest !== false;
  const session = await auth.api.getSession({ headers: await headers() });

  if (session?.user?.id) {
    const dbUser = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (dbUser && !dbUser.isGuest) {
      return {
        user: {
          id: dbUser.id,
          name: dbUser.name,
          email: dbUser.email,
          emailVerified: dbUser.emailVerified,
          image: dbUser.image,
          createdAt: dbUser.createdAt,
          isGuest: false
        },
        isGuest: false,
        usage: null
      };
    }
  }

  if (!allowGuest) return null;

  if (!createGuest) {
    const existing = await peekGuestActor();
    if (!existing) return null;
    return {
      user: existing.user,
      isGuest: true,
      usage: existing.usage
    };
  }

  const guest = await getOrCreateGuestActor();
  return {
    user: guest.user,
    isGuest: true,
    usage: guest.usage
  };
}

export async function getGuestUsageForActor(actor: RequestActor): Promise<GuestUsage | null> {
  if (!actor.isGuest) return null;
  return getGuestUsageForUser(actor.user.id);
}
