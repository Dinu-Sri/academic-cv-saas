import type { User } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function getOrCreateWorkspaceForUser(user: Pick<User, "id" | "name" | "email">) {
  const existingMember = await prisma.workspaceMember.findFirst({
    where: { userId: user.id },
    include: {
      workspace: {
        include: {
          profiles: {
            where: { ownerUserId: user.id },
            take: 1
          },
          creditWallet: true
        }
      }
    }
  });

  if (existingMember) {
    const profile =
      existingMember.workspace.profiles[0] ??
      (await prisma.academicProfile.create({
        data: {
          workspaceId: existingMember.workspaceId,
          ownerUserId: user.id,
          displayName: user.name,
          email: user.email
        }
      }));

    return {
      workspace: existingMember.workspace,
      profile
    };
  }

  const baseSlug = slugify(user.name || user.email.split("@")[0] || "workspace") || "workspace";
  let slug = baseSlug;
  let suffix = 1;

  while (await prisma.workspace.findUnique({ where: { slug } })) {
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }

  const workspace = await prisma.workspace.create({
    data: {
      name: `${user.name || "Academic"} Workspace`,
      slug,
      members: {
        create: {
          userId: user.id,
          role: "owner"
        }
      },
      creditWallet: {
        create: {
          balance: 50
        }
      },
      profiles: {
        create: {
          ownerUserId: user.id,
          displayName: user.name,
          email: user.email
        }
      }
    },
    include: {
      profiles: {
        where: { ownerUserId: user.id },
        take: 1
      },
      creditWallet: true
    }
  });

  return {
    workspace,
    profile: workspace.profiles[0]
  };
}
